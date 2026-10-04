import {
  createAssetBucket,
  createStorage,
  readStorageEnv,
} from '@folyo/db/storage';
import { createAssetRepository } from './asset-repository';
import { createPageRepository } from './page-repository';
import { createEditorRepository } from './editor-repository';
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
  return {
    assets: createAssetBucket(readStorageEnv(process.env)),
    sites: env.SITES_BUCKET,
  };
}

export function editorRepository() {
  return createEditorRepository(serverEnv().DATABASE_URL);
}

export function assetRepository() {
  return createAssetRepository(serverEnv().DATABASE_URL);
}
export function objectStorage() {
  return createStorage(readStorageEnv(process.env));
}
export function pageRepository() {
  return createPageRepository(serverEnv().DATABASE_URL);
}
