import { reorderPagesSchema } from '@folyo/core';
import { body, route } from '../../../../lib/api';
import { pageContext } from '../../../../lib/page-api';
import { AccountError } from '../../../../lib/account-service';
export const PUT = route(async (request) => {
  const { site, repo } = await pageContext(request);
  const { pageIds } = await body(request, reorderPagesSchema);
  if (!(await repo.reorder(site.id, pageIds)))
    throw new AccountError('invalid', 400);
  return Response.json({ ok: true });
});
