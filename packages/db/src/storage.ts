import { AwsClient } from 'aws4fetch';
import { z } from 'zod';
export const storageEnvSchema = z.object({
  R2_ACCOUNT_ID: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/),
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
});
export class StorageConfigError extends Error {
  constructor(
    public fields: { name: string; reason: 'missing' | 'invalid' }[],
  ) {
    super('R2 configuration missing or invalid');
  }
}
export function readStorageEnv(input: unknown) {
  const parsed = storageEnvSchema.safeParse(input);
  if (!parsed.success) {
    const values =
      input && typeof input === 'object'
        ? (input as Record<string, unknown>)
        : {};
    throw new StorageConfigError(
      parsed.error.issues.map((issue) => {
        const name = String(issue.path[0]);
        const value = values[name];
        return {
          name,
          reason:
            typeof value !== 'string' || !value.trim()
              ? ('missing' as const)
              : ('invalid' as const),
        };
      }),
    );
  }
  return parsed.data;
}
// Diagnostics never contain request headers, credentials, signed canonical requests or stacks.
export function redactDiagnostic(value: string, secrets: string[] = []) {
  let safe = value;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    for (const encoded of new Set([
      secret,
      encodeURIComponent(secret),
      secret.replace(
        /[&<>"']/g,
        (char) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;',
          })[char] ?? char,
      ),
    ]))
      safe = safe.split(encoded).join('[REDACTED]');
  }
  return safe
    .replace(
      /<(AWSAccessKeyId|AccessKeyId|SecretAccessKey|SignatureProvided|Signature|StringToSign|StringToSignBytes|CanonicalRequest|CanonicalRequestBytes|Authorization|SecurityToken|SessionToken|Token|Password)\b[^>]*>[\s\S]*?<\/\1>/gi,
      '<$1>[REDACTED]</$1>',
    )
    .replace(/(?:postgres(?:ql)?:|https?:)\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(
      /(Credential|Signature|X-Amz-Security-Token)=[^\s,&<]+/gi,
      '$1=[REDACTED]',
    )
    .slice(0, 4096);
}
export class StorageRequestError extends Error {
  constructor(
    public details: {
      method: string;
      key: string;
      upstreamStatus: number | null;
      responseBody: string | null;
      causeCode: string | null;
      causeMessage?: string;
    },
  ) {
    super('Object storage unavailable');
  }
}
function networkCode(error: unknown): string | null {
  const outer = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = outer?.cause?.code ?? outer?.code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : null;
}
async function storageFetch(
  client: AwsClient,
  url: string | URL,
  init: RequestInit,
  key: string,
  secrets: string[],
) {
  try {
    return await client.fetch(url, init);
  } catch (error) {
    throw new StorageRequestError({
      method: init.method ?? 'GET',
      key,
      upstreamStatus: null,
      responseBody: null,
      causeCode: networkCode(error),
      causeMessage: redactDiagnostic(
        error instanceof Error ? error.message : 'Unknown network failure',
        secrets,
      ),
    });
  }
}
async function responseError(
  response: Response,
  method: string,
  key: string,
  secrets: string[],
) {
  const body = await response
    .text()
    .catch(() => '[Unable to read R2 response body]');
  return new StorageRequestError({
    method,
    key,
    upstreamStatus: response.status,
    responseBody: redactDiagnostic(body, secrets),
    causeCode: null,
  });
}
export interface ObjectStorage {
  putObject(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Response | null>;
  deleteObject(key: string): Promise<void>;
}
export function createStorage(
  input: z.infer<typeof storageEnvSchema>,
): ObjectStorage {
  const env = readStorageEnv(input);
  const secrets = [env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY];
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 2,
  });
  const url = (key: string) => {
    if (
      !key ||
      key.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error('Invalid object key');
    return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/folyo-assets/${key.split('/').map(encodeURIComponent).join('/')}`;
  };
  return {
    async putObject(key, body, contentType) {
      const response = await storageFetch(
        client,
        url(key),
        {
          method: 'PUT',
          body,
          // R2 requires an explicit length; Next/Workers fetch may not infer it.
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(body.byteLength),
          },
        },
        key,
        secrets,
      );
      if (!response.ok)
        throw await responseError(response, 'PUT', key, secrets);
    },
    async getObject(key) {
      const response = await storageFetch(
        client,
        url(key),
        { method: 'GET' },
        key,
        secrets,
      );
      if (response.status === 404) return null;
      if (!response.ok)
        throw await responseError(response, 'GET', key, secrets);
      return response;
    },
    async deleteObject(key) {
      const response = await storageFetch(
        client,
        url(key),
        { method: 'DELETE' },
        key,
        secrets,
      );
      if (!response.ok && response.status !== 404)
        throw await responseError(response, 'DELETE', key, secrets);
    },
  };
}

// Account cleanup must use the same remote assets bucket as uploads, including in dev.
export function createAssetBucket(input: z.infer<typeof storageEnvSchema>) {
  const env = readStorageEnv(input);
  const secrets = [env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY];
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 2,
  });
  const storage = createStorage(env);
  const decodeXml = (value: string) =>
    value.replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, entity: string) =>
        ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity] ?? '',
    );
  return {
    async list(options: { prefix: string; cursor?: string; limit: number }) {
      const url = new URL(
        `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/folyo-assets`,
      );
      url.searchParams.set('list-type', '2');
      url.searchParams.set('encoding-type', 'url');
      url.searchParams.set('prefix', options.prefix);
      url.searchParams.set('max-keys', String(options.limit));
      if (options.cursor)
        url.searchParams.set('continuation-token', options.cursor);
      const response = await storageFetch(
        client,
        url,
        { method: 'GET' },
        options.prefix,
        secrets,
      );
      if (!response.ok)
        throw await responseError(response, 'GET', options.prefix, secrets);
      const xml = await response.text();
      if (!xml.includes('<ListBucketResult'))
        throw new Error('Invalid object listing');
      const objects = [...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map((match) => ({
        key: decodeURIComponent(decodeXml(match[1] ?? '')),
      }));
      const cursor = xml.match(
        /<NextContinuationToken>(.*?)<\/NextContinuationToken>/,
      )?.[1];
      return {
        objects,
        truncated: xml.includes('<IsTruncated>true</IsTruncated>'),
        ...(cursor ? { cursor: decodeXml(cursor) } : {}),
      };
    },
    async delete(keys: string[]) {
      for (let offset = 0; offset < keys.length; offset += 4)
        await Promise.all(
          keys
            .slice(offset, offset + 4)
            .map((key) => storage.deleteObject(key)),
        );
    },
  };
}
