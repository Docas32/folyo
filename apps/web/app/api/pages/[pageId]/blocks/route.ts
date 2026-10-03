import { z } from 'zod';
import { saveBlocksSchema } from '@folyo/core';
import { apiAccount, body, route } from '../../../../../lib/api';
import { editorRepository } from '../../../../../lib/runtime';
import {
  assertEditorOwner,
  saveEditorBlocks,
} from '../../../../../lib/editor-service';
import { AccountError } from '../../../../../lib/account-service';
export async function PUT(
  request: Request,
  context: { params: Promise<{ pageId: string }> },
) {
  return route(async (req) => {
    const { user, site } = await apiAccount(req, 'site');
    if (!site) throw new AccountError('siteRequired', 409);
    assertEditorOwner(user.id, site);
    const id = z
      .string()
      .uuid()
      .safeParse((await context.params).pageId);
    if (!id.success) throw new AccountError('notFound', 404);
    const repo = editorRepository();
    // Check ownership before parsing content, concealing foreign page IDs.
    if (!(await repo.findPage(id.data, site.id)))
      throw new AccountError('notFound', 404);
    const input = await body(req, saveBlocksSchema);
    const result = await saveEditorBlocks(
      repo,
      user.id,
      site,
      id.data,
      input.blocks,
    );
    return Response.json(result);
  })(request);
}
