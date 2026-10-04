import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStorage,
  readStorageEnv,
  StorageConfigError,
  StorageRequestError,
} from './storage';
afterEach(() => vi.unstubAllGlobals());
const env = {
  R2_ACCOUNT_ID: 'a'.repeat(32),
  R2_ACCESS_KEY_ID: 'test-access',
  R2_SECRET_ACCESS_KEY: 'test-secret',
};
describe('S3-compatible object storage', () => {
  it('signs PUT using the real bucket, MIME and body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await createStorage(env).putObject(
      'assets/user/photo.webp',
      new Uint8Array([1, 2]).buffer,
      'image/webp',
    );
    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/folyo-assets/assets/user/photo.webp`,
    );
    expect(request.method).toBe('PUT');
    expect(request.headers.get('content-type')).toBe('image/webp');
    expect(request.headers.get('content-length')).toBe('2');
    expect(request.headers.get('authorization')).toContain(
      '/auto/s3/aws4_request',
    );
    expect(new Uint8Array(await request.arrayBuffer())).toEqual(
      new Uint8Array([1, 2]),
    );
  });
  it('maps 404 to absence and preserves a successful streaming response', async () => {
    const response = new Response('image', {
      headers: { 'Content-Type': 'image/png' },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetch);
    const storage = createStorage(env);
    expect(await storage.getObject('missing.png')).toBeNull();
    expect(await storage.getObject('photo.png')).toBe(response);
  });
  it('does not expose upstream errors or accept traversal keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private error', { status: 403 })),
    );
    const storage = createStorage(env);
    await expect(storage.getObject('photo.png')).rejects.toThrow(
      'Object storage unavailable',
    );
    await expect(storage.getObject('../private')).rejects.toThrow(
      'Invalid object key',
    );
  });
});

describe('remote account asset cleanup', () => {
  it('lists encoded keys and continuation tokens, then deletes using S3', async () => {
    const { createAssetBucket } = await import('./storage');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          '<ListBucketResult><EncodingType>url</EncodingType><Contents><Key>assets%2Fuser%2Fphoto.png</Key></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>a&amp;b</NextContinuationToken></ListBucketResult>',
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const bucket = createAssetBucket(env);
    expect(
      await bucket.list({
        prefix: 'assets/user/',
        limit: 1000,
        cursor: 'previous',
      }),
    ).toEqual({
      objects: [{ key: 'assets/user/photo.png' }],
      truncated: true,
      cursor: 'a&b',
    });
    const listing = fetch.mock.calls[0]?.[0] as Request;
    expect(new URL(listing.url).searchParams.get('prefix')).toBe(
      'assets/user/',
    );
    expect(new URL(listing.url).searchParams.get('continuation-token')).toBe(
      'previous',
    );
    await bucket.delete(['assets/user/photo.png']);
    expect((fetch.mock.calls[1]?.[0] as Request).method).toBe('DELETE');
  });
});

describe('safe R2 diagnostics', () => {
  it('reports missing or invalid field names without leaking config values', () => {
    try {
      readStorageEnv({
        R2_ACCOUNT_ID: 'invalid-account-value',
        R2_ACCESS_KEY_ID: '   ',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(StorageConfigError);
      expect((error as StorageConfigError).fields).toEqual([
        { name: 'R2_ACCOUNT_ID', reason: 'invalid' },
        { name: 'R2_ACCESS_KEY_ID', reason: 'missing' },
        { name: 'R2_SECRET_ACCESS_KEY', reason: 'missing' },
      ]);
      expect(JSON.stringify(error)).not.toContain('invalid-account-value');
      return;
    }
    throw new Error('Expected config rejection');
  });
  it('retains R2 status/XML but redacts key, secret and signing material', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            `<Error><Code>SignatureDoesNotMatch</Code><Message>${env.R2_SECRET_ACCESS_KEY}</Message><AWSAccessKeyId>${env.R2_ACCESS_KEY_ID}</AWSAccessKeyId><SignatureProvided>signature-value</SignatureProvided><CanonicalRequest>private signed headers</CanonicalRequest></Error>`,
            { status: 403 },
          ),
        ),
    );
    try {
      await createStorage(env).putObject(
        'assets/user/image.png',
        new ArrayBuffer(1),
        'image/png',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(StorageRequestError);
      const details = (error as StorageRequestError).details;
      expect(details).toMatchObject({
        method: 'PUT',
        key: 'assets/user/image.png',
        upstreamStatus: 403,
      });
      expect(details.responseBody).toContain(
        '<Code>SignatureDoesNotMatch</Code>',
      );
      for (const secret of [
        env.R2_SECRET_ACCESS_KEY,
        env.R2_ACCESS_KEY_ID,
        'signature-value',
        'private signed headers',
      ])
        expect(details.responseBody).not.toContain(secret);
      return;
    }
    throw new Error('Expected upstream error');
  });
  it('distinguishes network failure from an HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          new Error('fetch failed', { cause: { code: 'ENOTFOUND' } }),
        ),
    );
    await expect(
      createStorage(env).getObject('image.png'),
    ).rejects.toMatchObject({
      details: {
        upstreamStatus: null,
        responseBody: null,
        causeCode: 'ENOTFOUND',
        causeMessage: 'fetch failed',
      },
    });
  });
});
