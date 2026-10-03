import Link from 'next/link';
import { legalDictionary } from '../../lib/legal';
export default async function LegalPage() {
  const d = await legalDictionary();
  return (
    <main>
      <h1>{d.termsLink}</h1>
      <p>{d.legalNotice}</p>
      <p>{d.termsBody}</p>
      <Link href="/">{d.home}</Link>
    </main>
  );
}
