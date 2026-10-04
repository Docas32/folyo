import { blockContentSchema } from '@folyo/core';
import { z } from 'zod';
import type { PreviewRepository } from './preview-repository';
export async function readPreview(
  repo: PreviewRepository,
  siteId: string,
  slug: string[] = [],
) {
  if (!z.string().uuid().safeParse(siteId).success || slug.length > 1)
    return undefined;
  const document = await repo.read(siteId);
  if (!document || document.site.id !== siteId) return undefined;
  const pages = document.pages
    .filter((page) => page.siteId === siteId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const active = slug.length
    ? pages.find((page) => page.slug === slug[0])
    : pages[0];
  if (slug.length && !active) return undefined;
  const blocks = document.blocks
    .filter((block) => block.pageId === active?.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .flatMap((block) => {
      const parsed = blockContentSchema.safeParse({
        type: block.type,
        content: block.content,
      });
      return parsed.success ? [{ ...parsed.data, id: block.id }] : [];
    });
  return { site: document.site, pages, active, blocks };
}
