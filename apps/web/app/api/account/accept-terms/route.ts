import { route, apiAccount, body } from '../../../../lib/api';
import { TERMS_VERSION, postLoginPath } from '../../../../lib/account-service';
import { termsSchema } from '../../../../lib/schemas';
export const POST = route(async (request) => {
  const { repo, user, site } = await apiAccount(request, 'user');
  await body(request, termsSchema);
  await repo.acceptTerms(user.id, TERMS_VERSION, new Date());
  return Response.json({
    redirect: postLoginPath({ ...user, termsAcceptedAt: new Date() }, site),
  });
});
