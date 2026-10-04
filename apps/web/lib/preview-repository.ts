import { asc, eq } from 'drizzle-orm';
import {
  blocks,
  createDb,
  pages,
  sites,
  users,
  type Database,
} from '@folyo/db';
export function previewRepositoryFromDb(db: Database) {
  return {
    async read(siteId: string) {
      // Only public rendering fields leave the repository; no email/user identifiers.
      const [siteRows, sitePages, pageBlocks] = await db.batch([
        db
          .select({
            id: sites.id,
            title: sites.title,
            description: sites.description,
            theme: sites.theme,
            locale: users.locale,
          })
          .from(sites)
          .innerJoin(users, eq(sites.userId, users.id))
          .where(eq(sites.id, siteId)),
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
          .innerJoin(pages, eq(blocks.pageId, pages.id))
          .where(eq(pages.siteId, siteId))
          .orderBy(asc(blocks.position), asc(blocks.id)),
      ]);
      return siteRows[0]
        ? { site: siteRows[0], pages: sitePages, blocks: pageBlocks }
        : undefined;
    },
  };
}
export function createPreviewRepository(databaseUrl: string) {
  return previewRepositoryFromDb(createDb(databaseUrl));
}
export type PreviewRepository = ReturnType<typeof createPreviewRepository>;
