import { apiAccount, route } from '../../../lib/api';
import { editorRepository } from '../../../lib/runtime';
import { loadEditor } from '../../../lib/editor-service';
import { AccountError } from '../../../lib/account-service';
export const GET = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  const document = await loadEditor(
    editorRepository(),
    user.id,
    site,
    user.locale,
  );
  return Response.json(document, { headers: { 'Cache-Control': 'no-store' } });
});
