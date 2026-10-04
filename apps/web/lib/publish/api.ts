import { apiAccount, route } from '../api';
import { AccountError } from '../account-service';
import {
  publicationBindings,
  publishEnvironment,
  publishRepository,
} from '../runtime';
import { getDictionary } from '../i18n';
import { changePublication } from './service';
export function publicationRoute(action: 'publish' | 'unpublish') {
  return route(async (request) => {
    const { user, site } = await apiAccount(request, 'site');
    if (!site) throw new AccountError('siteRequired', 409);
    if (site.userId !== user.id) throw new AccountError('unauthorized', 403);
    try {
      const env = publishEnvironment();
      const result = await changePublication(
        action,
        publishRepository(),
        await publicationBindings(),
        user.id,
        site,
        env,
      );
      return Response.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (error) {
      if (
        error instanceof AccountError &&
        (error.code === 'publishAppUrlRequired' ||
          error.code === 'publishAppUrlInvalid')
      ) {
        return Response.json(
          {
            error: error.code,
            message: getDictionary(user.locale).publication[error.code],
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw error;
    }
  });
}
