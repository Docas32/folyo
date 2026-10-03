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
