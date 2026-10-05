import { LegalPage } from '../../components/legal-page';
import { legalDictionary } from '../../lib/legal';
export async function generateMetadata() {
  const d = await legalDictionary();
  return {
    title: `${d.privacyLink} · Folyo`,
    description: d.legal.privacy[0]?.paragraphs[0],
  };
}
export default function Privacy() {
  return <LegalPage kind="privacy" />;
}
