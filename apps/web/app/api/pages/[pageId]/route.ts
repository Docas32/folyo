import { pageTitleSchema } from '@folyo/core';
import { body, route } from '../../../../lib/api';
import { pageContext } from '../../../../lib/page-api';
import { AccountError } from '../../../../lib/account-service';
type Context = { params: Promise<{ pageId: string }> };
export async function PATCH(request: Request, context: Context) {
  return route(async (req) => {
    const { pageId } = await context.params;
    const { site, repo } = await pageContext(req, pageId);
    const { title } = await body(req, pageTitleSchema);
    const page = await repo.rename(site.id, pageId, title);
    if (!page) throw new AccountError('notFound', 404);
    return Response.json(page);
  })(request);
}
export async function DELETE(request: Request, context: Context) {
  return route(async (req) => {
    const { pageId } = await context.params;
    const { site, repo } = await pageContext(req, pageId);
    if (!(await repo.remove(site.id, pageId)))
      throw new AccountError('invalid', 400);
    return Response.json({ ok: true });
  })(request);
}
