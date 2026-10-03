import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '../auth';
import { accountContext } from '../lib/session';
import { AccountError, postLoginPath } from '../lib/account-service';
import { getDictionary } from '../lib/i18n';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  let context;
  try {
    context = await accountContext();
  } catch (error) {
    if (!(error instanceof AccountError && error.status === 401)) throw error;
  }
  if (context) redirect(postLoginPath(context.user, context.site));
  const language = (await headers()).get('accept-language');
  const d = getDictionary(
    language?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en',
  );
  return (
    <main>
      <h1>{d.brand}</h1>
      <h2>{d.welcome}</h2>
      <p>{d.welcomeBody}</p>
      {error && <p role="alert">{d.signInError}</p>}
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/post-login' });
        }}
      >
        <button>{d.googleLogin}</button>
      </form>
    </main>
  );
}
