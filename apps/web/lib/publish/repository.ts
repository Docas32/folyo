import { and, asc, eq, sql } from 'drizzle-orm';
import {
  blocks,
  createDb,
  pages,
  publications,
  publicationOperations,
  recomputeOrphansQuery,
  sites,
  users,
  type Database,
} from '@folyo/db';
import { AccountError, type Site } from '../account-service';
export function publishRepositoryFromDb(db: Database) {
  const editorLock = (siteId: string) =>
    db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`}, 0))`,
    );
  const ownsLock = (siteId: string, token: string) =>
    and(
      eq(publicationOperations.siteId, siteId),
      eq(publicationOperations.token, token),
    );
  return {
    async acquire(siteId: string, userId: string, token: string) {
      const [, acquired, siteRows, sitePages, siteBlocks] = await db.batch([
        editorLock(siteId),
        db
          .insert(publicationOperations)
          .values({ siteId, token })
          .onConflictDoNothing()
          .returning({ token: publicationOperations.token }),
        db
          .select({ site: sites, locale: users.locale })
          .from(sites)
          .innerJoin(users, eq(users.id, sites.userId))
          .where(and(eq(sites.id, siteId), eq(sites.userId, userId))),
        db
          .select()
          .from(pages)
          .where(eq(pages.siteId, siteId))
          .orderBy(asc(pages.position), asc(pages.id)),
        db
          .select({
            id: blocks.id,
            pageId: blocks.pageId,
            type: blocks.type,
            content: blocks.content,
            position: blocks.position,
          })
          .from(blocks)
          .innerJoin(pages, eq(pages.id, blocks.pageId))
          .where(eq(pages.siteId, siteId))
          .orderBy(asc(pages.position), asc(blocks.position), asc(blocks.id)),
      ]);
      if (!acquired.length) throw new AccountError('publicationBusy', 409);
      return siteRows[0]
        ? { ...siteRows[0], pages: sitePages, blocks: siteBlocks }
        : undefined;
    },
    async protect(siteId: string, token: string, keys: string[]) {
      await db.batch([
        editorLock(siteId),
        db
          .update(publicationOperations)
          .set({ assetsKeys: keys })
          .where(ownsLock(siteId, token)),
        recomputeOrphansQuery(db, { siteId }),
      ]);
    },
    async record(
      siteId: string,
      version: number,
      r2Prefix: string,
      assetsKeys: string[],
      publishedAt: Date,
    ) {
      // Retry after a failed previous attempt can reuse only an unactivated version.
      await db
        .insert(publications)
        .values({ siteId, version, r2Prefix, assetsKeys, publishedAt })
        .onConflictDoUpdate({
          target: [publications.siteId, publications.version],
          set: { r2Prefix, assetsKeys, publishedAt },
        });
    },
    async activate(siteId: string, version: number) {
      await db.batch([
        editorLock(siteId),
        db
          .update(sites)
          .set({
            status: 'published',
            publishedVersion: version,
            updatedAt: new Date(),
          })
          .where(eq(sites.id, siteId)),
        recomputeOrphansQuery(db, { siteId }),
      ]);
    },
    async draft(siteId: string) {
      await db.batch([
        editorLock(siteId),
        db
          .update(sites)
          .set({ status: 'draft', updatedAt: new Date() })
          .where(eq(sites.id, siteId)),
        recomputeOrphansQuery(db, { siteId }),
      ]);
    },
    async release(siteId: string, token: string) {
      await db.batch([
        editorLock(siteId),
        db.delete(publicationOperations).where(ownsLock(siteId, token)),
        recomputeOrphansQuery(db, { siteId }),
      ]);
    },
    async publishedAt(site: Pick<Site, 'id' | 'publishedVersion'>) {
      const row = await db.query.publications.findFirst({
        where: and(
          eq(publications.siteId, site.id),
          eq(publications.version, site.publishedVersion),
        ),
      });
      return row?.publishedAt?.toISOString() ?? null;
    },
  };
}
export function createPublishRepository(databaseUrl: string) {
  return publishRepositoryFromDb(createDb(databaseUrl));
}
export type PublishRepository = ReturnType<typeof createPublishRepository>;
