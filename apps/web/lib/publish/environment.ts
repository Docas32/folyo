import { environmentSchema } from '@folyo/core';
import { z } from 'zod';
import { AccountError } from '../account-service';
export const appPublicUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  });
export function requireAppPublicUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new AccountError('publishAppUrlRequired', 400);
  const parsed = appPublicUrlSchema.safeParse(value);
  if (!parsed.success) throw new AccountError('publishAppUrlInvalid', 400);
  return parsed.data;
}

export const publishEnvironmentSchema = environmentSchema
  .extend({
    SITE_EDGE_PORT: z
      .string()
      .regex(/^(?:[1-9][0-9]{0,4})?$/)
      .refine((value) => !value || Number(value) <= 65535)
      .default('8787'),
    APP_PUBLIC_URL: appPublicUrlSchema,
  })
  .refine((env) => env.ENVIRONMENT !== 'dev' || env.SITE_EDGE_PORT !== '', {
    path: ['SITE_EDGE_PORT'],
    message: 'Edge port is required in dev',
  });
/** Validate the image origin before any publication side effects. */
export function readPublishEnvironment(
  input: Record<string, unknown>,
): PublishEnvironment {
  requireAppPublicUrl(input.APP_PUBLIC_URL);
  return publishEnvironmentSchema.parse(input);
}
export type PublishEnvironment = z.infer<typeof publishEnvironmentSchema>;
/** Public URLs always target Edge; APP_PUBLIC_URL is only the app/asset origin. */
export function buildPublicSiteUrl(
  handle: string,
  env: Pick<
    PublishEnvironment,
    'ROOT_DOMAIN' | 'ENVIRONMENT' | 'SITE_EDGE_PORT'
  >,
) {
  const url = new URL(
    `${env.ENVIRONMENT === 'dev' ? 'http' : 'https'}://${handle}.${env.ROOT_DOMAIN}`,
  );
  if (env.ENVIRONMENT === 'dev') url.port = env.SITE_EDGE_PORT;
  return url.origin;
}
