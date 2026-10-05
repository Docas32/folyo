import type { Metadata } from 'next';
import { Button } from '../components/ui/button';
import { redirect } from 'next/navigation';
import { signIn } from '../auth';
import { accountContext } from '../lib/session';
import { AccountError, postLoginPath } from '../lib/account-service';
import { legalDictionary } from '../lib/legal';
import { Landing } from '../components/landing';
export async function generateMetadata(): Promise<Metadata> {
  const d = await legalDictionary();
  const locale = d.public.locale === 'pt-BR' ? 'pt' : 'en';
  const origin = process.env.APP_PUBLIC_URL;
  return {
    title: d.public.title,
    description: d.public.description,
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    openGraph: {
      title: d.public.title,
      description: d.public.description,
      type: 'website',
      images: [
        {
          url: `/og-${locale}.png`,
          width: 1200,
          height: 630,
          alt: d.public.tagline,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: d.public.title,
      description: d.public.description,
      images: [`/og-${locale}.png`],
    },
  };
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  let context;
  try {
    context = await accountContext();
  } catch (error) {
    if (!(error instanceof AccountError && error.status === 401)) throw error;
  }
  if (context) redirect(postLoginPath(context.user, context.site));
  const d = await legalDictionary();
  const locale = d.public.locale;
  return (
    <Landing
      d={d}
      locale={locale}
      error={Boolean(error)}
      login={
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/post-login' });
          }}
        >
          <Button variant="primary" type="submit">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M21 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h5a4.3 4.3 0 0 1-1.9 2.8 6 6 0 1 1 .2-9.5l2.6-2.6A9.5 9.5 0 1 0 21 12.2Z" />
            </svg>
            {d.googleLogin}
          </Button>
        </form>
      }
    />
  );
}
