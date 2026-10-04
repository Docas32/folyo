import { createSiteDeletionRepository } from './site-deletion-repository';
import type { DeletionBindings } from './site-deletion-service';
import { createTemplateRepository } from './template-repository';
import { createPublishRepository } from './publish/repository';
import { readPublishEnvironment } from './publish/environment';
import { createPreviewRepository } from './preview-repository';
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

export function previewRepository() {
  return createPreviewRepository(serverEnv().DATABASE_URL);
}

export async function publicationBindings() {
  const { env } = await getCloudflareContext({ async: true });
  return { sites: env.SITES_BUCKET, kv: env.SITE_KV };
}
export { publishEnvironmentSchema } from './publish/environment';
export function publishEnvironment() {
  return readPublishEnvironment(process.env);
}
export function publishRepository() {
  return createPublishRepository(serverEnv().DATABASE_URL);
}

export function templateRepository() {
  return createTemplateRepository(serverEnv().DATABASE_URL);
}

export function siteDeletionRepository() {
  return createSiteDeletionRepository(serverEnv().DATABASE_URL);
}
export async function siteDeletionBindings(): Promise<DeletionBindings> {
  const { env } = await getCloudflareContext({ async: true });
  return {
    kv: env.SITE_KV,
    sites: async () => env.SITES_BUCKET,
    assets: async () => (await accountBuckets()).assets,
  };
}
