import { signOut } from '../../../auth';
import { route, apiAccount, body } from '../../../lib/api';
import { deleteAccount, AccountError } from '../../../lib/account-service';
import { deleteAccountSchema } from '../../../lib/schemas';
import { accountBuckets } from '../../../lib/runtime';
export const DELETE = route(async (request) => {
  const { repo, user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  const input = await body(request, deleteAccountSchema);
  await deleteAccount(
    repo,
    await accountBuckets(),
    user.id,
    site,
    input.handle,
  );
  // Expire the JWT cookie in this response, including any chunked cookies.
  // Deleted-user tokens are also rejected by the server account guards.
  await signOut({ redirect: false });
  return Response.json({ redirect: '/' });
});
