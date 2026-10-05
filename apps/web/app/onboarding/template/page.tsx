import { legalDictionary } from '../../../lib/legal';
import { pageAccount } from '../../../lib/session';
import { getDictionary, supportedLocale } from '../../../lib/i18n';
import { TemplateGallery } from '../../../components/templates';
export default async function TemplateOnboarding() {
  const { user } = await pageAccount('template');
  const d = getDictionary(user.locale);
  return (
    <main className="templates-page">
      <h1>{d.templates.heading}</h1>
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
