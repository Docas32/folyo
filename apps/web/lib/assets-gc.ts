import { and, eq, lt, not, sql } from 'drizzle-orm';
import { assets, publishedAssetProtection, type Database } from '@folyo/db';
import type { ObjectStorage } from '@folyo/db/storage';
export function gcRepository(db: Database) {
  return {
    expired: (before: Date) =>
      db
        .select({ id: assets.id, r2Key: assets.r2Key })
        .from(assets)
        .where(
          and(
            lt(assets.orphanedAt, before),
            not(publishedAssetProtection(sql`${assets.r2Key}`)),
          ),
        ),
    async protected(key: string) {
      const rows = await db
        .select({ id: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.r2Key, key),
            publishedAssetProtection(sql`${assets.r2Key}`),
          ),
        );
      return rows.length > 0;
    },
    remove: (id: string, before: Date) =>
      db
        .delete(assets)
        .where(and(eq(assets.id, id), lt(assets.orphanedAt, before))),
  };
}
export async function collectAssets(
  request: Request,
  secret: string | undefined,
  graceDays: string | undefined,
  repo: () => ReturnType<typeof gcRepository>,
  storage: () => ObjectStorage,
  cleanupDeletedSites?: () => Promise<void>,
) {
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const days = graceDays === undefined ? 7 : Number(graceDays);
  if (!Number.isFinite(days) || days <= 0)
    return Response.json({ error: 'Invalid GC_GRACE_DAYS' }, { status: 500 });
  const before = new Date(Date.now() - days * 86400000);
  await cleanupDeletedSites?.();
  const repository = repo();
  const bucket = storage();
  const keys: string[] = [];
  // Recheck after candidate selection: a publish may have protected a key meanwhile.
  for (const asset of await repository.expired(before)) {
    try {
      if (await repository.protected(asset.r2Key)) continue;
      await bucket.deleteObject(asset.r2Key);
      await repository.remove(asset.id, before);
      keys.push(asset.r2Key);
    } catch {
      console.error('Asset GC failed', { key: asset.r2Key });
    }
  }
  return Response.json({ deleted: keys.length, keys });
}
