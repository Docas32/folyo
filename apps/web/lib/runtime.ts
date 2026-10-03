import { z } from 'zod';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { databaseUrlSchema, environmentSchema } from '@folyo/core';
import { createRepository } from './repository';
export const serverEnvSchema = environmentSchema.extend({
  DATABASE_URL: databaseUrlSchema,
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
});
export function serverEnv() {
  return serverEnvSchema.parse(process.env);
}
export function repository() {
  return createRepository(serverEnv().DATABASE_URL);
}
export async function accountBuckets() {
  const { env } = await getCloudflareContext({ async: true });
  return { assets: env.ASSETS_BUCKET, sites: env.SITES_BUCKET };
}
