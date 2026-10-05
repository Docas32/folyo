import { CookieBanner } from '../components/cookie-banner';
import type { ReactNode } from 'react';
import {
  Inter,
  Lora,
  Playfair_Display,
  Source_Sans_3,
  Space_Grotesk,
} from 'next/font/google';
import { headers } from 'next/headers';
import { getDictionary, supportedLocale } from '../lib/i18n';
import { accountContext } from '../lib/session';
import { AccountError } from '../lib/account-service';
import './globals.css';
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
export const metadata = {
  title: getDictionary('en').brand,
  icons: { icon: '/favicon.svg', shortcut: '/favicon.ico' },
};
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
  const d = getDictionary(locale);
  return (
    <html
      lang={locale}
      className={[
        inter.variable,
        lora.variable,
        playfair.variable,
        sourceSans.variable,
        spaceGrotesk.variable,
      ].join(' ')}
    >
      {/* Browser zoom extensions can inject inline styles before hydration.
          Ignore attribute differences on body only; children stay checked. */}
      <body suppressHydrationWarning>
        {children}
        <CookieBanner
          d={{
            privacyLink: d.privacyLink,
            public: { cookies: d.public.cookies },
          }}
        />
      </body>
    </html>
  );
}
