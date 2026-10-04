import { and, eq, sql } from 'drizzle-orm';
import {
  assets,
  createDb,
  sites,
  siteDeletions,
  type Database,
} from '@folyo/db';
import { AccountError } from './account-service';
export type SiteDeletion = typeof siteDeletions.$inferSelect;
export function siteDeletionRepositoryFromDb(db: Database) {
  return {
    async remove(siteId: string, userId: string): Promise<SiteDeletion> {
      const [, result] = await db.batch([
        db.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`}, 0))`,
        ),
        db.execute(sql`with deleted_site as (
          delete from sites where id = ${siteId}::uuid and user_id = ${userId}::uuid
          and not exists (select 1 from publication_operations where site_id = ${siteId}::uuid)
          returning id, user_id, handle
        ), deleted_assets as (
          delete from assets where user_id in (select user_id from deleted_site) returning r2_key
        ) insert into site_deletions (site_id, user_id, handle, asset_keys)
          select id, user_id, handle, coalesce((select jsonb_agg(r2_key) from deleted_assets), '[]'::jsonb)
          from deleted_site returning site_id as "siteId", user_id as "userId", handle, asset_keys as "assetKeys", created_at as "createdAt"`),
      ]);
      const row = result.rows[0];
      if (!row) {
        const existing = await db.query.sites.findFirst({
          where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
        });
        throw new AccountError(
          existing ? 'publicationBusy' : 'notFound',
          existing ? 409 : 404,
        );
      }
      // Raw Neon timestamps are strings, unlike Drizzle-mapped select results.
      return {
        siteId: String(row.siteId),
        userId: String(row.userId),
        handle: String(row.handle),
        assetKeys: row.assetKeys as string[],
        createdAt: new Date(String(row.createdAt)),
      };
    },
    pending: () => db.select().from(siteDeletions).limit(25),
    async liveAssetKeys(userId: string) {
      const rows = await db
        .select({ key: assets.r2Key })
        .from(assets)
        .where(eq(assets.userId, userId));
      return new Set(rows.map((row) => row.key));
    },
    async hasSite(userId: string) {
      return Boolean(
        await db.query.sites.findFirst({ where: eq(sites.userId, userId) }),
      );
    },
    complete: (siteId: string) =>
      db.delete(siteDeletions).where(eq(siteDeletions.siteId, siteId)),
  };
}
export function createSiteDeletionRepository(databaseUrl: string) {
  return siteDeletionRepositoryFromDb(createDb(databaseUrl));
}
export type SiteDeletionRepository = ReturnType<
  typeof createSiteDeletionRepository
>;
