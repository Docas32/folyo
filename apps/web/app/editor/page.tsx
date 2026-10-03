import { redirect } from 'next/navigation';
import { pageAccount } from '../../lib/session';
import { getDictionary, supportedLocale } from '../../lib/i18n';
import { loadEditor } from '../../lib/editor-service';
import { editorRepository } from '../../lib/runtime';
import { AccountError } from '../../lib/account-service';
import { Editor } from '../../components/editor/editor';
export default async function EditorPage() {
  const { user, site } = await pageAccount('app');
  if (!site) redirect('/onboarding');
  const document = await loadEditor(
    editorRepository(),
    user.id,
    site,
    user.locale,
  );
  const page = document.pages[0];
  if (!page) throw new AccountError('unavailable', 503);
  return (
    <Editor
      key={page.id}
      document={document}
      pageId={page.id}
      d={getDictionary(user.locale)}
      locale={supportedLocale(user.locale)}
    />
  );
}
