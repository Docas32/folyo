import Link from 'next/link';
import { pageAccount } from '../../lib/session';
import { getDictionary, supportedLocale } from '../../lib/i18n';
import { TermsForm } from '../../components/forms';
import { Logout } from '../../components/logout';
export default async function AcceptTerms() {
  const { user } = await pageAccount('terms');
  const d = getDictionary(user.locale);
  return (
    <main>
      <h1>{d.termsHeading}</h1>
      <p>{d.termsSummary}</p>
      <nav>
        <Link href="/terms">{d.termsLink}</Link>
        <Link href="/privacy">{d.privacyLink}</Link>
      </nav>
      <TermsForm d={d} locale={supportedLocale(user.locale)} />
      <Logout label={d.signOut} />
    </main>
  );
}
