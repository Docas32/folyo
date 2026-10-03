import {
  editorDocumentSchema,
  createDefaultBlock,
  getBlockPlaceholders,
  type EditorBlock,
  type EditorPage,
} from '@folyo/core';
import { AccountError, type Site } from './account-service';
export interface EditorRepository {
  bootstrapAndRead(
    siteId: string,
    locale: string,
  ): Promise<{ pages: EditorPage[]; blocks: unknown[] }>;
  findPage(pageId: string, siteId: string): Promise<EditorPage | undefined>;
  replaceBlocks(
    siteId: string,
    pageId: string,
    blocks: EditorBlock[],
  ): Promise<string>;
}
export function assertEditorOwner(userId: string, site: Site) {
  if (site.userId !== userId) throw new AccountError('unauthorized', 403);
}
export async function loadEditor(
  repo: EditorRepository,
  userId: string,
  site: Site,
  locale: string,
) {
  assertEditorOwner(userId, site);
  const rows = await repo.bootstrapAndRead(site.id, locale);
  return editorDocumentSchema.parse({
    site: {
      id: site.id,
      title: site.title,
      handle: site.handle,
      status: site.status,
    },
    ...rows,
  });
}
export async function saveEditorBlocks(
  repo: EditorRepository,
  userId: string,
  site: Site,
  pageId: string,
  blocks: EditorBlock[],
) {
  assertEditorOwner(userId, site);
  const page = await repo.findPage(pageId, site.id);
  if (!page || page.siteId !== site.id) throw new AccountError('notFound', 404);
  const savedAt = await repo.replaceBlocks(site.id, page.id, blocks);
  return { ok: true as const, savedAt };
}
// Bootstrap content comes from exactly the same factory as the palette.
export function initialPage(locale: string) {
  const p = getBlockPlaceholders(locale);
  return {
    title: p.pageTitle,
    slug: p.pageSlug,
    hero: createDefaultBlock('hero', locale),
  };
}
