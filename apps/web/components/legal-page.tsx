import Link from 'next/link';
import { legalDictionary } from '../lib/legal';
import { AppFooter } from './app-footer';
import { Logo } from './logo';
export async function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const d = await legalDictionary();
  const email = process.env.LEGAL_CONTACT_EMAIL;
  const owner = process.env.LEGAL_ENTITY_NAME;
  return (
    <main className="public-page legal-page">
      <Link href="/" aria-label={d.home}>
        <Logo />
      </Link>
      <h1>{kind === 'terms' ? d.termsLink : d.privacyLink}</h1>
      <p className="muted">{d.public.legalUpdated}</p>
      {d.legal[kind].map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
      <section>
        <h2>{d.public.legalContact}</h2>
        {owner && (
          <p>
            {d.public.legalOwner}: {owner}
          </p>
        )}
        {email ? (
          <a href={`mailto:${email}`}>{email}</a>
        ) : (
          <p>{d.public.contactPending}</p>
        )}
      </section>
      <AppFooter d={d} />
    </main>
  );
}
