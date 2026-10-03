import { pageAccount } from '../../lib/session';
import { getDictionary, supportedLocale } from '../../lib/i18n';
import { HandleForm } from '../../components/forms';
import { Logout } from '../../components/logout';
export default async function Onboarding() {
  const { user } = await pageAccount('onboarding');
  const d = getDictionary(user.locale);
  return (
    <main>
      <h1>{d.onboardingHeading}</h1>
      <HandleForm d={d} locale={supportedLocale(user.locale)} />
      <Logout label={d.signOut} />
    </main>
  );
}
