import Link from 'next/link';
import { pageAccount } from '../../lib/session';
import { getDictionary } from '../../lib/i18n';
export default async function EditorStub() {
  const { user } = await pageAccount('app');
  const d = getDictionary(user.locale);
  return (
    <main>
      <h1>{d.editorStub}</h1>
      <Link href="/dashboard">{d.back}</Link>
    </main>
  );
}
