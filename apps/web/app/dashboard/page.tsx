import { ButtonLink, PreviewIcon } from '../../components/ui/button';
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
        <div className="dashboard-link-row">
          <span className="dashboard-url" title={url}>
            <a href={url} aria-label={d.publicLink}>
              {url}
            </a>
          </span>
          <CopyLink url={url} d={d} />
          <ButtonLink
            href={`/p/${site.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {d.preview} <PreviewIcon />
          </ButtonLink>
        </div>
      </section>
      <nav className="dashboard-actions">
        <ButtonLink href="/editor">{d.edit}</ButtonLink>
        <ButtonLink href="/settings" variant="ghost">
          {d.settings}
        </ButtonLink>
        <Logout label={d.signOut} />
      </nav>
    </main>
  );
}
