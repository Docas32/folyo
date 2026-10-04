import Link from 'next/link';
import { TemplateToast } from '../../components/template-toast';
import { editorRepository } from '../../lib/runtime';
import { isVirginSite } from '../../lib/templates';
import { ButtonLink, PreviewIcon } from '../../components/ui/button';
import { redirect } from 'next/navigation';
import { pageAccount } from '../../lib/session';
import { publishEnvironment, publishRepository } from '../../lib/runtime';
import { buildPublicSiteUrl } from '../../lib/publish/environment';
import { PublicationActions } from '../../components/publication-actions';
import { getDictionary } from '../../lib/i18n';
import { CopyLink } from '../../components/forms';
import { Logout } from '../../components/logout';
export default async function Dashboard() {
  const { user, site } = await pageAccount('app');
  if (!site) redirect('/onboarding');
  const d = getDictionary(user.locale);
  const document =
    site.templateId === 'blank'
      ? await editorRepository().bootstrapAndRead(site.id, user.locale)
      : null;
  const virgin =
    document &&
    isVirginSite(
      site,
      document.pages,
      document.blocks as { type: string; content: unknown }[],
    );
  const url = buildPublicSiteUrl(site.handle, publishEnvironment());
  const publishedAt =
    site.status === 'published'
      ? await publishRepository().publishedAt(site)
      : null;
  return (
    <main>
      <h1>{d.dashboardHeading}</h1>
      <TemplateToast />
      {virgin && (
        <p className="template-banner">
          <Link href="/templates">{d.templates.banner}</Link>
        </p>
      )}
      <div data-ad-slot="dashboard-top" />
      <section>
        <PublicationActions
          status={site.status}
          version={site.publishedVersion}
          publishedAt={publishedAt}
          url={url}
          d={d}
          locale={user.locale}
        />
        <h2>{site.handle}</h2>
        <div className="dashboard-link-row">
          <span className="dashboard-url" title={url}>
            <a
              href={url}
              aria-label={d.publicLink}
              target="_blank"
              rel="noopener noreferrer"
            >
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
