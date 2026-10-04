import { and, asc, eq, sql } from 'drizzle-orm';
import {
  createDb,
  recomputeOrphansQuery,
  pages,
  type Database,
} from '@folyo/db';
import { MAX_PAGES, slugify, type EditorPage } from '@folyo/core';
export interface PageRepository {
  list(siteId: string): Promise<EditorPage[]>;
  find(pageId: string, siteId: string): Promise<EditorPage | undefined>;
  create(siteId: string, title: string): Promise<EditorPage | undefined>;
  rename(
    siteId: string,
    pageId: string,
    title: string,
  ): Promise<EditorPage | undefined>;
  remove(siteId: string, pageId: string): Promise<boolean>;
  reorder(siteId: string, pageIds: string[]): Promise<boolean>;
}
export function createPageRepository(databaseUrl: string): PageRepository {
  return pageRepositoryFromDb(createDb(databaseUrl));
}
export function pageRepositoryFromDb(db: Database): PageRepository {
  const lock = (siteId: string) =>
    db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`}, 0))`,
    );
  const list = (siteId: string) =>
    db
      .select()
      .from(pages)
      .where(eq(pages.siteId, siteId))
      .orderBy(asc(pages.position), asc(pages.id));
  return {
    list,
    find: (pageId, siteId) =>
      db.query.pages.findFirst({
        where: and(eq(pages.id, pageId), eq(pages.siteId, siteId)),
      }),
    async create(siteId, title) {
      const id = crypto.randomUUID();
      const slug = slugify(title);
      const [, , rows] = await db.batch([
        lock(siteId),
        db.execute(sql`insert into pages (id, site_id, title, slug, position)
          select ${id}::uuid, ${siteId}::uuid, ${title}, candidate.slug,
            coalesce((select max(position) + 1 from pages where site_id = ${siteId}::uuid), 0)
          from (
            select case when n = 1 then ${slug} else ${slug} || '-' || n::text end as slug
            from generate_series(1, ${MAX_PAGES + 1}) as n
            where not exists (select 1 from pages where site_id = ${siteId}::uuid
              and slug = case when n = 1 then ${slug} else ${slug} || '-' || n::text end)
            order by n limit 1
          ) as candidate
          where (select count(*) from pages where site_id = ${siteId}::uuid) < ${MAX_PAGES}`),
        list(siteId),
      ]);
      return rows.find((page) => page.id === id);
    },
    async rename(siteId, pageId, title) {
      const [, rows] = await db.batch([
        lock(siteId),
        db
          .update(pages)
          .set({ title })
          .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
          .returning(),
      ]);
      return rows[0];
    },
    async remove(siteId, pageId) {
      const [, rows] = await db.batch([
        lock(siteId),
        db
          .delete(pages)
          .where(
            and(
              eq(pages.id, pageId),
              eq(pages.siteId, siteId),
              sql`(select count(*) from pages where site_id = ${siteId}::uuid) > 1`,
            ),
          )
          .returning({ id: pages.id }),
        recomputeOrphansQuery(db, { siteId }),
      ]);
      return rows.length === 1;
    },
    async reorder(siteId, pageIds) {
      // The exact-set guard runs after the lock, inside the same transaction.
      const ids = JSON.stringify(pageIds);
      const [, rows] = await db.batch([
        lock(siteId),
        db
          .update(pages)
          .set({
            position: sql`(
          select (ordinality - 1)::int from jsonb_array_elements_text(${ids}::jsonb) with ordinality
          where value::uuid = ${pages.id}
        )`,
          })
          .where(
            and(
              eq(pages.siteId, siteId),
              sql`(select count(*) from pages where site_id = ${siteId}::uuid) = ${pageIds.length}`,
              sql`not exists (select 1 from pages where site_id = ${siteId}::uuid
            and id::text not in (select value from jsonb_array_elements_text(${ids}::jsonb)))`,
              sql`(select count(distinct value) from jsonb_array_elements_text(${ids}::jsonb)) = ${pageIds.length}`,
            ),
          )
          .returning({ id: pages.id }),
      ]);
      return rows.length === pageIds.length;
    },
  };
}
