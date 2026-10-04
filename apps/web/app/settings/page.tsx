import { DeletePortfolio } from '../../components/delete-portfolio';
import { publishEnvironment } from '../../lib/runtime';
import { buildPublicSiteUrl } from '../../lib/publish/environment';
import { AppearanceSettings } from '../../components/templates';
import { editorRepository } from '../../lib/runtime';
import { isVirginSite } from '../../lib/templates';
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
  const document = await editorRepository().bootstrapAndRead(site.id, locale);
  const virgin = isVirginSite(
    site,
    document.pages,
    document.blocks as { type: string; content: unknown }[],
  );
  return (
    <main>
      <h1>{d.settingsHeading}</h1>
      <Link href="/dashboard">{d.back}</Link>
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
      <AppearanceSettings
        d={d}
        locale={locale}
        siteId={site.id}
        initialTheme={site.theme}
        virgin={virgin}
      />
      <DeletePortfolio
        d={d}
        handle={site.handle}
        publicUrl={buildPublicSiteUrl(site.handle, publishEnvironment())}
      />
      <DeleteAccountForm d={d} locale={locale} handle={site.handle} />
    </main>
  );
}
