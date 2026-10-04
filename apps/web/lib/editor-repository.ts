import { AccountError } from './account-service';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  createDb,
  recomputeOrphansQuery,
  pages,
  blocks,
  sites,
  type Database,
} from '@folyo/db';
import type { EditorRepository } from './editor-service';
import { initialPage } from './editor-service';
export function createEditorRepository(databaseUrl: string): EditorRepository {
  return editorRepositoryFromDb(createDb(databaseUrl));
}
// Exposed for testing the actual transaction plan without a live Neon account.
export function editorRepositoryFromDb(db: Database): EditorRepository {
  const lock = (siteId: string) =>
    db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`}, 0))`,
    );
  return {
    async bootstrapAndRead(siteId, locale) {
      const initial = initialPage(locale);
      // READ COMMITTED + transaction advisory lock: the next statement observes
      // any prior bootstrap after waiting. Hero is inserted ONLY from new_page,
      // so empty pages stay empty after a user removes all blocks.
      const [, , sitePages, pageBlocks] = await db.batch([
        lock(siteId),
        db.execute(sql`with new_page as (
          insert into pages (id, site_id, title, slug, position)
          select gen_random_uuid(), ${siteId}::uuid, ${initial.title}, ${initial.slug}, 0
          where not exists (select 1 from pages where site_id = ${siteId}::uuid)
          returning id
        ) insert into blocks (id, page_id, type, content, position)
          select gen_random_uuid(), id, 'hero', ${JSON.stringify(initial.hero)}::jsonb, 0 from new_page`),
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
          .where(
            sql`${blocks.pageId} in (select id from pages where site_id = ${siteId}::uuid)`,
          )
          .orderBy(asc(blocks.position), asc(blocks.id)),
      ]);
      return { pages: sitePages, blocks: pageBlocks };
    },
    async findPage(pageId, siteId) {
      return db.query.pages.findFirst({
        where: and(eq(pages.id, pageId), eq(pages.siteId, siteId)),
      });
    },
    async replaceBlocks(siteId, pageId, incoming) {
      const deletion = db
        .delete(blocks)
        .where(
          and(
            eq(blocks.pageId, pageId),
            sql`exists (select 1 from pages where id = ${pageId}::uuid and site_id = ${siteId}::uuid)`,
          ),
        );
      const touch = db
        .update(sites)
        .set({ updatedAt: sql`clock_timestamp()` })
        .where(eq(sites.id, siteId))
        .returning({ savedAt: sites.updatedAt });
      // Delete + insert is atomic. A block ID from another page causes a PK
      // collision and rolls back, rather than stealing the other page's block.
      const values = incoming.map((block) => ({ ...block, pageId }));
      const results = values.length
        ? await db.batch([
            lock(siteId),
            deletion,
            db.insert(blocks).values(values),
            recomputeOrphansQuery(db, { siteId }),
            touch,
          ])
        : await db.batch([
            lock(siteId),
            deletion,
            recomputeOrphansQuery(db, { siteId }),
            touch,
          ]);
      const timestamps = results[results.length - 1];
      // The final query always returns updated_at; batch tuple variants differ.
      const saved = Array.isArray(timestamps) ? timestamps[0] : undefined;
      if (!saved || !('savedAt' in saved) || !(saved.savedAt instanceof Date))
        throw new AccountError('unavailable', 503);
      return saved.savedAt.toISOString();
    },
  };
}
