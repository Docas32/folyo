import {
  availableHandleSchema,
  blockContentSchema,
  extractAssetKeys,
  resolveTheme,
} from '@folyo/core';
import type { Site } from '../account-service';
import { AccountError } from '../account-service';
import type { PublishRepository } from './repository';
import type { PublishEnvironment } from './environment';
import { buildPublicSiteUrl } from './environment';
import {
  renderPageHtml,
  renderSiteCss,
  type SnapshotBlock,
} from './render-page';
export type PublicationBindings = {
  sites: Pick<R2Bucket, 'put'>;
  kv: Pick<KVNamespace, 'get' | 'put' | 'delete'>;
};
export async function changePublication(
  action: 'publish' | 'unpublish',
  repo: PublishRepository,
  bindings: PublicationBindings,
  ownerId: string,
  site: Site,
  env: PublishEnvironment,
) {
  if (site.userId !== ownerId) throw new AccountError('unauthorized', 403);
  const token = crypto.randomUUID();
  let acquired = false;
  let keepLock = false;
  try {
    const snapshot = await repo.acquire(site.id, ownerId, token);
    acquired = true;
    if (!snapshot || snapshot.site.userId !== ownerId)
      throw new AccountError('unauthorized', 403);
    const current = snapshot.site;
    const key = `site:${current.handle}`;
    const oldPointer = await bindings.kv.get(key);
    if (action === 'unpublish') {
      try {
        await bindings.kv.delete(key);
        await repo.draft(current.id);
      } catch (error) {
        try {
          if (oldPointer !== null) await bindings.kv.put(key, oldPointer);
        } catch {
          keepLock = true;
        }
        throw error;
      }
      return { ok: true };
    }
    if (!availableHandleSchema.safeParse(current.handle).success)
      throw new AccountError('publishHandleInvalid', 400);
    if (!current.title?.trim())
      throw new AccountError('publishTitleRequired', 400);
    if (!snapshot.pages.length)
      throw new AccountError('publishPagesRequired', 400);
    const version = current.publishedVersion + 1;
    const prefix = `sites/${current.id}/v${version}/`;
    const pageBlocks: SnapshotBlock[] = snapshot.blocks.map((block) => ({
      ...blockContentSchema.parse({ type: block.type, content: block.content }),
      id: block.id,
      pageId: block.pageId,
      position: block.position,
    }));
    const assetKeys = [...extractAssetKeys(pageBlocks)];
    await repo.protect(current.id, token, assetKeys);
    const theme = resolveTheme(current.theme);
    const publicUrl = buildPublicSiteUrl(current.handle, env);
    const opts = { appUrl: env.APP_PUBLIC_URL, publicUrl, version };
    // Each write completes before the routing pointer can change.
    for (const [index, page] of snapshot.pages.entries()) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))
        throw new AccountError('invalid', 400);
      const html = await renderPageHtml(
        { ...current, locale: snapshot.locale },
        page,
        pageBlocks,
        snapshot.pages,
        theme,
        opts,
      );
      await bindings.sites.put(
        `${prefix}${index === 0 ? '' : `${page.slug}/`}index.html`,
        html,
        { httpMetadata: { contentType: 'text/html; charset=utf-8' } },
      );
    }
    await bindings.sites.put(`${prefix}site.css`, renderSiteCss(theme), {
      httpMetadata: { contentType: 'text/css; charset=utf-8' },
    });
    await repo.record(current.id, version, prefix, assetKeys, new Date());
    try {
      await bindings.kv.put(
        key,
        JSON.stringify({ siteId: current.id, version }),
      );
      await repo.activate(current.id, version);
    } catch (error) {
      // KV/R2/Neon have no shared transaction. Restore routing on DB failure.
      try {
        if (oldPointer === null) await bindings.kv.delete(key);
        else await bindings.kv.put(key, oldPointer);
      } catch {
        keepLock = true;
      }
      throw error;
    }
    return { url: publicUrl, version };
  } finally {
    // Retain serialization + asset protection if compensation failed; operator recovery required.
    if (acquired && !keepLock) await repo.release(site.id, token);
  }
}
