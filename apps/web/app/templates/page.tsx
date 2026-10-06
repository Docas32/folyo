import { legalDictionary } from '../../lib/legal';
import { pageAccount } from '../../lib/session';
import { getDictionary, supportedLocale } from '../../lib/i18n';
import { TemplateGallery } from '../../components/templates';
import { ButtonLink } from '../../components/ui/button';
export default async function Templates() {
  const { user } = await pageAccount('app');
  const d = getDictionary(user.locale);
  return (
    <main className="templates-page">
      <header className="templates-page-header">
        <div>
          <p className="page-eyebrow">Folyo / {d.templates.section}</p>
          <h1>{d.templates.heading}</h1>
        </div>
        <ButtonLink href="/dashboard" variant="ghost">
          ← {d.dashboardHub.back}
        </ButtonLink>
      </header>
      <p>{d.templates.intro}</p>
      <TemplateGallery d={d} locale={supportedLocale(user.locale)} />
    </main>
  );
}

export async function generateMetadata() {
  const d = await legalDictionary();
  return {
    title: `${d.templates.heading} · Folyo`,
    robots: { index: false, follow: false },
  };
}
