import { deletePortfolio } from '../../../lib/site-deletion-service';
import {
  siteDeletionBindings,
  siteDeletionRepository,
} from '../../../lib/runtime';
import { deleteAccountSchema } from '../../../lib/schemas';
import { route, apiAccount, body } from '../../../lib/api';
import { patchSite, AccountError } from '../../../lib/account-service';
import { sitePatchSchema } from '../../../lib/schemas';
export const PATCH = route(async (request) => {
  const { repo, user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  const input = await body(request, sitePatchSchema);
  await patchSite(repo, user.id, site, input);
  return Response.json({});
});

export const DELETE = route(async (request) => {
  const { user, site } = await apiAccount(request, 'terms');
  if (!site || site.userId !== user.id) throw new AccountError('notFound', 404);
  if (request.body) {
    const input = await body(request, deleteAccountSchema);
    if (input.handle !== site.handle)
      throw new AccountError('confirmation', 400);
  }
  return Response.json(
    await deletePortfolio(
      siteDeletionRepository(),
      await siteDeletionBindings(),
      user.id,
      site,
    ),
  );
});
