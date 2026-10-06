import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Dictionary } from '../lib/i18n';
import { Logo } from './logo';
import { AppFooter } from './app-footer';
import { SiteRender } from './render/site-render';
import { AmbientBackground } from './ambient-background';
export function Landing({
  d,
  locale,
  login,
  error,
}: {
  d: Dictionary;
  locale: string;
  login: ReactNode;
  error?: boolean;
}) {
  const p = d.public;
  return (
    <main className="landing">
      <AmbientBackground />
      <header className="landing-header">
        <Logo />
        <nav aria-label={d.public.navigation}>
          <Link href="/terms">{d.termsLink}</Link>
          <Link href="/privacy">{d.privacyLink}</Link>
        </nav>
      </header>
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow">Folyo</p>
          <h1>{p.tagline}</h1>
          <p className="landing-subtitle">{p.subtitle}</p>
          {error && <p role="alert">{d.signInError}</p>}
          {login}
        </div>
        <div className="landing-mock" role="img" aria-label={p.exampleLabel}>
          <div className="mock-browser">
            <span />
            <span />
            <span />
            <span>{p.exampleHandle}</span>
          </div>
          <div inert>
            <SiteRender
              theme={{
                preset: 'creative',
                accent: '#FF5C38',
                headingFont: 'lora',
                heroLayout: 'left',
              }}
              locale={locale}
              pages={[
                { id: 'home', title: p.examplePage, slug: '' },
                { id: 'about', title: p.exampleAbout, slug: 'about' },
              ]}
              activePageId="home"
              basePath="#"
              appUrl="#"
              chrome={d.siteChrome}
              blocks={[
                {
                  id: 'hero',
                  type: 'hero',
                  content: {
                    name: p.exampleName,
                    title: p.exampleTitle,
                    subtitle: p.exampleBio,
                  },
                },
                {
                  id: 'heading',
                  type: 'heading',
                  content: { text: p.exampleWork, level: 3 },
                },
                {
                  id: 'gallery',
                  type: 'gallery',
                  content: {
                    items: [
                      {
                        url: '/template-assets/studio-1.svg',
                        alt: p.exampleWork,
                      },
                      {
                        url: '/template-assets/studio-2.svg',
                        alt: p.exampleWork,
                      },
                    ],
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="landing-features">
        {p.features.map((feature, index) => (
          <section key={feature.title}>
            <span className="feature-index" aria-hidden="true">
              0{index + 1}
            </span>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </section>
        ))}
      </div>
      <AppFooter d={d} />
    </main>
  );
}
