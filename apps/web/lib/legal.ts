import { headers } from 'next/headers';
import { accountContext } from './session';
import { AccountError } from './account-service';
import { getDictionary } from './i18n';
export async function legalDictionary() {
  let user;
  try {
    user = (await accountContext()).user;
  } catch (error) {
    if (!(error instanceof AccountError && error.status === 401)) throw error;
  }
  const browserLocale = (await headers())
    .get('accept-language')
    ?.toLowerCase()
    .startsWith('pt')
    ? 'pt-BR'
    : 'en';
  return getDictionary(user?.locale ?? browserLocale);
}
