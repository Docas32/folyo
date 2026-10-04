import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({
  objectStorage: vi.fn(),
  assetRepository: vi.fn(),
}));
import { accountContext } from './session';
import { objectStorage, assetRepository } from './runtime';
import { POST } from '../app/api/upload/route';
import { GET } from '../app/api/assets/[...key]/route';
import { MAX_UPLOAD_BYTES } from '@folyo/core';
import { StorageRequestError, readStorageEnv } from '@folyo/db/storage';
import { AccountError } from './account-service';
import { user, site, mockRepository } from './fixtures.test-helper';
const assetId = '30000000-0000-4000-8000-000000000003';
const key = `assets/${user.id}/${assetId}.webp`;
const storage = {
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
};
const assets = { insert: vi.fn() };
function upload(
  mime = 'image/webp',
  size = 12,
  metadata = { width: '800', height: '600', alt: 'Landscape' },
) {
  const form = new FormData();
  form.set(
    'file',
    new File([new Uint8Array(size)], 'photo.webp', { type: mime }),
  );
  Object.entries(metadata).forEach(([name, value]) => form.set(name, value));
  return new Request('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
    body: form,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
  vi.mocked(objectStorage).mockReturnValue(storage);
  vi.mocked(assetRepository).mockReturnValue(assets);
  storage.putObject.mockResolvedValue(undefined);
  storage.deleteObject.mockResolvedValue(undefined);
  assets.insert.mockResolvedValue(assetId);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('image upload API', () => {
  it.each(['image/svg+xml', 'image/gif', 'text/html'])(
    'rejects %s with 415',
    async (mime) => {
      expect((await POST(upload(mime))).status).toBe(415);
      expect(storage.putObject).not.toHaveBeenCalled();
    },
  );
  it('rejects files over 5 MB with 413', async () => {
    expect(
      (await POST(upload('image/jpeg', MAX_UPLOAD_BYTES + 1))).status,
    ).toBe(413);
    expect(assets.insert).not.toHaveBeenCalled();
  });
  it('uploads the object and records metadata for the authenticated user', async () => {
    const response = await POST(upload());
    expect(response.status).toBe(201);
    const result = (await response.json()) as { url: string; assetId: string };
    expect(result.assetId).toBe(assetId);
    expect(result.url).toMatch(
      new RegExp(`^/api/assets/assets/${user.id}/[a-f0-9-]+\\.webp$`),
    );
    const r2Key = result.url.slice('/api/assets/'.length);
    expect(storage.putObject).toHaveBeenCalledWith(
      r2Key,
      expect.any(ArrayBuffer),
      'image/webp',
    );
    expect(assets.insert).toHaveBeenCalledWith({
      userId: user.id,
      r2Key,
      mime: 'image/webp',
      size: 12,
      width: 800,
      height: 600,
      alt: 'Landscape',
    });
  });
  it('logs complete success only after object and asset insert', async () => {
    expect((await POST(upload())).status).toBe(201);
    expect(console.info).toHaveBeenCalledWith(
      '[upload] success',
      expect.stringContaining('"status":201'),
    );
    expect(console.error).not.toHaveBeenCalled();
  });
  it('logs missing configuration names without values and returns a distinct 503', async () => {
    vi.mocked(objectStorage).mockImplementation(() => createMissingConfig());
    const response = await POST(upload());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'storageConfig' });
    const log = vi.mocked(console.error).mock.calls[0]?.[1] as string;
    expect(JSON.parse(log)).toMatchObject({
      stage: 'storage-config',
      fields: expect.arrayContaining([
        { name: 'R2_ACCESS_KEY_ID', reason: 'missing' },
        { name: 'R2_SECRET_ACCESS_KEY', reason: 'missing' },
      ]),
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('logs upstream credential status and sanitized XML without exposing it in the response', async () => {
    vi.stubEnv('R2_ACCESS_KEY_ID', 'sensitive-access');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'sensitive-secret');
    storage.putObject.mockRejectedValue(
      new StorageRequestError({
        method: 'PUT',
        key,
        upstreamStatus: 403,
        causeCode: null,
        responseBody:
          '<Error><Code>SignatureDoesNotMatch</Code><Message>sensitive-secret</Message><AWSAccessKeyId>sensitive-access</AWSAccessKeyId><StringToSign>private signing material</StringToSign></Error>',
      }),
    );
    const response = await POST(upload());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'storageUnavailable' });
    const log = vi.mocked(console.error).mock.calls[0]?.[1] as string;
    expect(log).toContain('"upstreamStatus":403');
    expect(log).toContain('SignatureDoesNotMatch');
    expect(log).toContain('[REDACTED]');
    for (const secret of [
      'sensitive-access',
      'sensitive-secret',
      'private signing material',
    ])
      expect(log).not.toContain(secret);
    expect(assets.insert).not.toHaveBeenCalled();
  });
  it('logs authorization and validation failures before mapping HTTP responses', async () => {
    expect((await POST(upload('image/gif'))).status).toBe(415);
    expect(console.error).toHaveBeenCalledWith(
      '[upload] failure',
      expect.stringContaining('"stage":"validation"'),
    );
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await POST(upload())).status).toBe(401);
    expect(console.error).toHaveBeenCalledWith(
      '[upload] failure',
      expect.stringContaining('"stage":"authorization"'),
    );
  });
  it('logs failed compensation independently and retains the DB failure status', async () => {
    assets.insert.mockRejectedValue(new Error('db down'));
    storage.deleteObject.mockRejectedValue(new Error('network down'));
    expect((await POST(upload())).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      '[upload] failure',
      expect.stringContaining('storage-cleanup'),
    );
    expect(console.error).toHaveBeenCalledWith(
      '[upload] failure',
      expect.stringContaining('asset-insert'),
    );
  });
  it('rejects malformed dimensions and empty alt', async () => {
    expect(
      (
        await POST(
          upload('image/png', 12, { width: '1601', height: 'NaN', alt: '' }),
        )
      ).status,
    ).toBe(400);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('requires an authenticated existing user and same-origin request', async () => {
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await POST(upload())).status).toBe(401);
    const request = upload();
    request.headers.set('origin', 'https://evil.example');
    expect((await POST(request)).status).toBe(403);
  });
  it('does not insert metadata on storage failure', async () => {
    storage.putObject.mockRejectedValue(
      new Error('private storage credentials'),
    );
    const response = await POST(upload());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'storageUnavailable' });
    expect(assets.insert).not.toHaveBeenCalled();
  });
  it('compensates the object when the DB insert fails', async () => {
    assets.insert.mockRejectedValue(new Error('db down'));
    expect((await POST(upload())).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      '[upload] failure',
      expect.stringContaining('asset-insert'),
    );
    expect(storage.deleteObject).toHaveBeenCalledOnce();
  });
});
describe('public assets API', () => {
  const get = (assetKey = key) =>
    GET(new Request(`http://localhost:3000/api/assets/${assetKey}`), {
      params: Promise.resolve({ key: assetKey.split('/') }),
    });
  it('returns 404 for a missing object', async () => {
    storage.getObject.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
  it('streams public images with immutable cache and the stored MIME', async () => {
    storage.getObject.mockResolvedValue(
      new Response('image bytes', {
        headers: { 'Content-Type': 'image/webp' },
      }),
    );
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('image bytes');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(accountContext).not.toHaveBeenCalled();
  });
  it.each(['../secret', 'sites/site/index.html', 'assets/user/photo.svg'])(
    'conceals invalid keys %s',
    async (invalid) => {
      expect((await get(invalid)).status).toBe(404);
      expect(storage.getObject).not.toHaveBeenCalled();
    },
  );
});

function createMissingConfig(): never {
  readStorageEnv({ R2_ACCOUNT_ID: 'a'.repeat(32) });
  throw new Error('Expected config validation failure');
}
