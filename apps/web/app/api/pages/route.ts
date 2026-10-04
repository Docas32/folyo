import { pageTitleSchema } from '@folyo/core';
import { body, route } from '../../../lib/api';
import { pageContext } from '../../../lib/page-api';
import { AccountError } from '../../../lib/account-service';
export const POST = route(async (request) => {
  const { site, repo } = await pageContext(request);
  const { title } = await body(request, pageTitleSchema);
  const page = await repo.create(site.id, title);
  if (!page) throw new AccountError('invalid', 400);
  return Response.json(page, { status: 201 });
});
