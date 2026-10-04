import {
  AccountError,
  clearPrefix,
  type Bucket,
  type Site,
} from './account-service';
import type {
  SiteDeletion,
  SiteDeletionRepository,
} from './site-deletion-repository';
export type DeletionBindings = {
  kv: Pick<KVNamespace, 'get' | 'delete'>;
  assets: () => Promise<Bucket>;
  sites: () => Promise<Bucket>;
};
async function clearDeletedAssets(
  repo: SiteDeletionRepository,
  bucket: Bucket,
  job: SiteDeletion,
) {
  const prefix = `assets/${job.userId}/`;
  const [live, recreated] = await Promise.all([
    repo.liveAssetKeys(job.userId),
    repo.hasSite(job.userId),
  ]);
  const known = new Set(job.assetKeys);
  let cursor: string | undefined;
  do {
    const page = await bucket.list({
      prefix,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    if (page.objects.some((object) => !object.key.startsWith(prefix)))
      throw new AccountError('unavailable', 503);
    const keys = page.objects
      .filter(
        (object) =>
          !live.has(object.key) &&
          (known.has(object.key) ||
            (object.uploaded
              ? object.uploaded.getTime() <
                Math.floor(job.createdAt.getTime() / 1000) * 1000
              : !recreated)),
      )
      .map((object) => object.key);
    if (keys.length) await bucket.delete(keys);
    if (page.truncated && !page.cursor)
      throw new AccountError('unavailable', 503);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
export async function finishSiteDeletion(
  repo: SiteDeletionRepository,
  bindings: DeletionBindings,
  job: SiteDeletion,
): Promise<boolean> {
  // KV comes first: failure must never be reported as successful unpublication.
  // Preserve a pointer now owned by a different site after handle reuse.
  const pointer = await bindings.kv.get(`site:${job.handle}`);
  let reused = false;
  if (pointer) {
    try {
      const value: unknown = JSON.parse(pointer);
      reused = Boolean(
        value &&
        typeof value === 'object' &&
        'siteId' in value &&
        typeof value.siteId === 'string' &&
        value.siteId !== job.siteId,
      );
    } catch {
      /* Invalid old routing pointer can be removed. */
    }
  }
  if (!reused) await bindings.kv.delete(`site:${job.handle}`);
  const results = await Promise.allSettled([
    (async () => clearPrefix(await bindings.sites(), `sites/${job.siteId}/`))(),
    (async () => clearDeletedAssets(repo, await bindings.assets(), job))(),
  ]);
  let success = true;
  for (const [index, result] of results.entries())
    if (result.status === 'rejected') {
      success = false;
      console.error('Portfolio cleanup pending', {
        siteId: job.siteId,
        bucket: index === 0 ? 'sites' : 'assets',
      });
    }
  if (success) {
    try {
      await repo.complete(job.siteId);
    } catch {
      console.error('Portfolio cleanup pending', {
        siteId: job.siteId,
        bucket: 'queue',
      });
      success = false;
    }
  }
  return success;
}
export async function deletePortfolio(
  repo: SiteDeletionRepository,
  bindings: DeletionBindings,
  userId: string,
  site: Site | undefined,
) {
  if (!site || site.userId !== userId) throw new AccountError('notFound', 404);
  // Cascade + assets + durable cleanup job commit before any object deletion.
  // The handle is immediately reusable. Handle-change cooldown does not apply
  // to createSite after deletion, because the old site's history is gone.
  const job = await repo.remove(site.id, userId);
  try {
    await finishSiteDeletion(repo, bindings, job);
  } catch {
    console.error('Portfolio routing cleanup pending', { siteId: job.siteId });
    throw new AccountError('unavailable', 503);
  }
  return { ok: true, handle: job.handle };
}
export async function collectDeletedPortfolios(
  repo: SiteDeletionRepository,
  bindings: DeletionBindings,
) {
  let cleaned = 0;
  for (const job of await repo.pending()) {
    try {
      if (await finishSiteDeletion(repo, bindings, job)) cleaned++;
    } catch {
      console.error('Portfolio cleanup retry failed', { siteId: job.siteId });
    }
  }
  return cleaned;
}
