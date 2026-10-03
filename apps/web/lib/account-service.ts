import { handleSchema, RESERVED_HANDLES } from '@folyo/core';
import type { assets, sites, users } from '@folyo/db';
import type { z } from 'zod';
import type { sitePatchSchema } from './schemas';
export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export const TERMS_VERSION = '2026-10-v1';
export const HANDLE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export type ErrorCode =
  | 'unauthorized'
  | 'termsRequired'
  | 'siteRequired'
  | 'invalid'
  | 'reserved'
  | 'taken'
  | 'cooldown'
  | 'confirmation'
  | 'conflict'
  | 'unavailable'
  | 'origin';
export class AccountError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    public nextAllowedAt?: string,
  ) {
    super(code);
  }
}
export interface Repository {
  findUser(id: string): Promise<User | undefined>;
  findSite(userId: string): Promise<Site | undefined>;
  isReserved(handle: string): Promise<boolean>;
  isTaken(handle: string, exceptSiteId?: string): Promise<boolean>;
  createSite(userId: string, handle: string): Promise<void>;
  acceptTerms(userId: string, version: string, now: Date): Promise<void>;
  updateSite(
    userId: string,
    siteId: string,
    patch: z.infer<typeof sitePatchSchema>,
    now: Date,
  ): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}
export function postLoginPath(user: User, site: Site | undefined) {
  return !user.termsAcceptedAt
    ? '/accept-terms'
    : !site
      ? '/onboarding'
      : '/dashboard';
}
export function nextHandleChange(
  changedAt: Date | null,
  now = new Date(),
): Date | null {
  if (!changedAt) return null;
  const allowed = new Date(changedAt.getTime() + HANDLE_COOLDOWN_MS);
  return allowed > now ? allowed : null;
}
export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === 'object';
    depth++
  ) {
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
export async function checkHandle(
  repo: Repository,
  raw: unknown,
  exceptSiteId?: string,
) {
  const parsed = handleSchema.safeParse(raw);
  if (!parsed.success) return { available: false, reason: 'invalid' as const };
  const handle = parsed.data;
  if (
    RESERVED_HANDLES.some((value) => value === handle) ||
    (await repo.isReserved(handle))
  )
    return { available: false, reason: 'reserved' as const };
  if (await repo.isTaken(handle, exceptSiteId))
    return { available: false, reason: 'taken' as const };
  return { available: true };
}
export async function createSite(
  repo: Repository,
  userId: string,
  handle: string,
) {
  if (await repo.findSite(userId)) throw new AccountError('conflict', 409);
  const result = await checkHandle(repo, handle);
  if (!result.available)
    throw new AccountError(
      result.reason ?? 'invalid',
      result.reason === 'invalid' ? 400 : 409,
    );
  try {
    await repo.createSite(userId, handleSchema.parse(handle));
  } catch (error) {
    if (isUniqueViolation(error)) throw new AccountError('taken', 409);
    throw error;
  }
}
export async function patchSite(
  repo: Repository,
  userId: string,
  site: Site,
  patch: z.infer<typeof sitePatchSchema>,
  now = new Date(),
) {
  if (site.userId !== userId) throw new AccountError('unauthorized', 403);
  const changesHandle =
    patch.handle !== undefined && patch.handle !== site.handle;
  if (changesHandle) {
    const allowed = nextHandleChange(site.handleChangedAt, now);
    if (allowed) throw new AccountError('cooldown', 409, allowed.toISOString());
    const result = await checkHandle(repo, patch.handle, site.id);
    if (!result.available)
      throw new AccountError(result.reason ?? 'invalid', 409);
  }
  try {
    if (!(await repo.updateSite(userId, site.id, patch, now))) {
      const current = await repo.findSite(userId);
      const allowed = current && nextHandleChange(current.handleChangedAt, now);
      if (allowed)
        throw new AccountError('cooldown', 409, allowed.toISOString());
      throw new AccountError('conflict', 409);
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new AccountError('taken', 409);
    throw error;
  }
}
// Structural interface keeps tests independent of Cloudflare's runtime types.
export interface Bucket {
  list(options: { prefix: string; cursor?: string; limit: number }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string[]): Promise<void>;
}
export async function clearPrefix(bucket: Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({
      prefix,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    if (page.objects.some((object) => !object.key.startsWith(prefix)))
      throw new AccountError('unavailable', 503);
    const keys = page.objects.map((object) => object.key);
    for (let index = 0; index < keys.length; index += 1000)
      await bucket.delete(keys.slice(index, index + 1000));
    if (page.truncated && !page.cursor)
      throw new AccountError('unavailable', 503);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
export async function deleteAccount(
  repo: Repository,
  buckets: { assets: Bucket; sites: Bucket },
  userId: string,
  site: Site,
  confirmation: string,
) {
  if (site.userId !== userId) throw new AccountError('unauthorized', 403);
  if (confirmation !== site.handle) throw new AccountError('confirmation', 400);
  // R2 cannot join PostgreSQL transactions. Clean it first, retaining DB IDs on
  // failure so retries can finish cleanup. Deletions are idempotent.
  await clearPrefix(buckets.sites, `sites/${site.id}/`);
  await clearPrefix(buckets.assets, `assets/${userId}/`);
  await repo.deleteUser(userId);
}
