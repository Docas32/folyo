import { LegalPage } from '../../components/legal-page';
import { legalDictionary } from '../../lib/legal';
export async function generateMetadata() {
  const d = await legalDictionary();
  return {
    title: `${d.termsLink} · Folyo`,
    description: d.legal.terms[0]?.paragraphs[0],
  };
}
export default function Terms() {
  return <LegalPage kind="terms" />;
}
