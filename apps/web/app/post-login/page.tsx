import { redirect } from 'next/navigation';
import { accountContext } from '../../lib/session';
import { AccountError, postLoginPath } from '../../lib/account-service';
export default async function PostLogin() {
  let context;
  try {
    context = await accountContext();
  } catch (error) {
    if (error instanceof AccountError && error.status === 401) redirect('/');
    throw error;
  }
  redirect(postLoginPath(context.user, context.site));
}
