import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { getDictionary, supportedLocale } from '../lib/i18n';
import { accountContext } from '../lib/session';
import { AccountError } from '../lib/account-service';
import './globals.css';
export const metadata = { title: getDictionary('en').brand };
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const language = (await headers()).get('accept-language');
  let locale = language?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  try {
    locale = supportedLocale((await accountContext()).user.locale);
  } catch (error) {
    if (!(error instanceof AccountError && error.status === 401)) throw error;
  }
  return (
    <html lang={locale}>
      {/* Browser zoom extensions can inject inline styles before hydration.
          Ignore attribute differences on body only; children stay checked. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
