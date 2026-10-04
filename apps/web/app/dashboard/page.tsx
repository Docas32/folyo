import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageAccount } from '../../lib/session';
import { serverEnv } from '../../lib/runtime';
import { getDictionary } from '../../lib/i18n';
import { CopyLink } from '../../components/forms';
import { Logout } from '../../components/logout';
export default async function Dashboard() {
  const { user, site } = await pageAccount('app');
  if (!site) redirect('/onboarding');
  const d = getDictionary(user.locale);
  const url = `https://${site.handle}.${serverEnv().ROOT_DOMAIN}`;
  return (
    <main>
      <h1>{d.dashboardHeading}</h1>
      <div data-ad-slot="dashboard-top" />
      <section>
        <p className="status-pill">
          {site.status === 'published' ? d.published : d.draft}
        </p>
        <h2>{site.handle}</h2>
        <a href={url} aria-label={d.publicLink}>
          {url}
        </a>
        <CopyLink url={url} d={d} />
      </section>
      <nav>
        <Link href="/editor">{d.edit}</Link>
        <Link href="/settings">{d.settings}</Link>
      </nav>
      <Logout label={d.signOut} />
    </main>
  );
}
