import { z } from 'zod';
import { apiAccount } from './api';
import { AccountError } from './account-service';
import { pageRepository } from './runtime';
import { assertEditorOwner } from './editor-service';
export async function pageContext(request: Request, pageId?: string) {
  const { user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  assertEditorOwner(user.id, site);
  const repo = pageRepository();
  if (
    pageId !== undefined &&
    (!z.string().uuid().safeParse(pageId).success ||
      !(await repo.find(pageId, site.id)))
  )
    throw new AccountError('notFound', 404);
  return { site, repo };
}
