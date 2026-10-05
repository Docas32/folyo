import { DashboardHub } from '../../components/dashboard-hub';
import { Logout } from '../../components/logout';
import { templateSchema } from '@folyo/core';
import { legalDictionary } from '../../lib/legal';
import { editorRepository } from '../../lib/runtime';
import { isVirginSite } from '../../lib/templates';
import { redirect } from 'next/navigation';
import { pageAccount } from '../../lib/session';
import { publishEnvironment, publishRepository } from '../../lib/runtime';
import { buildPublicSiteUrl } from '../../lib/publish/environment';
import { getDictionary } from '../../lib/i18n';
export default async function Dashboard() {
  const { user, site } = await pageAccount('app');
  if (!site) redirect('/onboarding');
  const d = getDictionary(user.locale);
  const document = await editorRepository().bootstrapAndRead(
    site.id,
    user.locale,
  );
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
  const activeTemplate = templateSchema.safeParse(site.templateId);
  return (
    <DashboardHub
      logout={<Logout label={d.signOut} />}
      d={d}
      locale={user.locale}
      firstName={user.name?.trim().split(/\s+/)[0] ?? ''}
      site={{
        id: site.id,
        handle: site.handle,
        status: site.status,
        publishedVersion: site.publishedVersion,
        faviconKey: site.faviconKey,
        updatedAt: (
          site.updatedAt ??
          site.createdAt ??
          new Date()
        ).toISOString(),
        activeTemplate: activeTemplate.success ? activeTemplate.data : 'blank',
      }}
      url={url}
      publishedAt={publishedAt}
      pages={document.pages.length}
      blocks={document.blocks.length}
      now={new Date().toISOString()}
      virgin={!!virgin}
    />
  );
}

export async function generateMetadata() {
  const d = await legalDictionary();
  return { title: `${d.dashboardHeading} · Folyo`, robots: { index: false } };
}
