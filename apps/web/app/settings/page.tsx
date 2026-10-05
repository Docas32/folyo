import { legalDictionary } from '../../lib/legal';
import { FaviconSettings } from '../../components/favicon-settings';
import { DeletePortfolio } from '../../components/delete-portfolio';
import { publishEnvironment } from '../../lib/runtime';
import { buildPublicSiteUrl } from '../../lib/publish/environment';
import { AppearanceSettings } from '../../components/templates';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageAccount } from '../../lib/session';
import { nextHandleChange } from '../../lib/account-service';
import { getDictionary, supportedLocale } from '../../lib/i18n';
import {
  DeleteAccountForm,
  HandleForm,
  MetadataForm,
} from '../../components/forms';
export default async function Settings() {
  const { user, site } = await pageAccount('app');
  if (!site) redirect('/onboarding');
  const d = getDictionary(user.locale);
  const locale = supportedLocale(user.locale);
  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <p className="page-eyebrow">{d.brand}</p>
          <h1>{d.settingsHeading}</h1>
        </div>
        <Link href="/dashboard">{d.dashboardHub.back}</Link>
      </header>
      <section>
        <MetadataForm
          key={`${site.title}-${site.description}`}
          d={d}
          locale={locale}
          title={site.title ?? ''}
          description={site.description ?? ''}
        />
      </section>
      <section>
        <h2>{d.changeHandle}</h2>
        <p>{d.changeHandleWarning}</p>
        <HandleForm
          key={site.handle}
          d={d}
          locale={locale}
          initial={site.handle}
          nextAllowedAt={nextHandleChange(site.handleChangedAt)?.toISOString()}
        />
      </section>
      <FaviconSettings d={d} initialKey={site.faviconKey} />
      <AppearanceSettings d={d} siteId={site.id} initialTheme={site.theme} />
      <DeletePortfolio
        d={d}
        handle={site.handle}
        publicUrl={buildPublicSiteUrl(site.handle, publishEnvironment())}
      />
      <DeleteAccountForm d={d} locale={locale} handle={site.handle} />
    </main>
  );
}

export async function generateMetadata() {
  const d = await legalDictionary();
  return { title: `${d.settingsHeading} · Folyo`, robots: { index: false } };
}
