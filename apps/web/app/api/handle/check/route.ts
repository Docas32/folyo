import { route, apiAccount } from '../../../../lib/api';
import { checkHandle } from '../../../../lib/account-service';
export const GET = route(async (request) => {
  const { repo, site } = await apiAccount(request, 'terms');
  const result = await checkHandle(
    repo,
    new URL(request.url).searchParams.get('handle'),
    site?.id,
  );
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
});
