import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '../auth';
import { repository } from './runtime';
import {
  AccountError,
  postLoginPath,
  type Repository,
} from './account-service';
export const accountContext = cache(async (providedRepo?: Repository) => {
  const session = await auth();
  if (!session?.user?.id) throw new AccountError('unauthorized', 401);
  const repo = providedRepo ?? repository();
  const user = await repo.findUser(session.user.id);
  if (!user) throw new AccountError('unauthorized', 401);
  const site = await repo.findSite(user.id);
  return { user, site, repo };
});
export async function pageAccount(
  stage: 'terms' | 'onboarding' | 'template' | 'app',
) {
  let context;
  try {
    context = await accountContext();
  } catch (error) {
    if (error instanceof AccountError && error.status === 401) redirect('/');
    throw error;
  }
  const path = postLoginPath(context.user, context.site);
  if (stage === 'terms' && path !== '/accept-terms') redirect(path);
  if (stage === 'onboarding' && path !== '/onboarding') redirect(path);
  if (
    stage === 'template' &&
    path !== '/onboarding/template' &&
    path !== '/dashboard'
  )
    redirect(path);
  if (stage === 'app' && path !== '/dashboard') redirect(path);
  return context;
}
