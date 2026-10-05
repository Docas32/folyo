import { accountContext } from './session';
import { AccountError } from './account-service';
import { isAdminEmail } from './admin-access';
export async function adminContext() {
  let context;
  try {
    context = await accountContext();
  } catch {
    throw new AccountError('notFound', 404);
  }
  if (!isAdminEmail(context.user.email))
    throw new AccountError('notFound', 404);
  return context;
}
