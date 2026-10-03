import { route, apiAccount, body } from '../../../lib/api';
import { createSite } from '../../../lib/account-service';
import { onboardingSchema } from '../../../lib/schemas';
export const POST = route(async (request) => {
  const { repo, user } = await apiAccount(request, 'terms');
  const input = await body(request, onboardingSchema);
  await createSite(repo, user.id, input.handle);
  return Response.json({ redirect: '/dashboard' }, { status: 201 });
});
