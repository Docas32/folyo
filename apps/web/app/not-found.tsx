import { ButtonLink } from '../components/ui/button';
import { Logo } from '../components/logo';
import { legalDictionary } from '../lib/legal';
export default async function NotFound() {
  const d = await legalDictionary();
  return (
    <main className="public-page not-found-page">
      <Logo />
      <p className="landing-eyebrow">404</p>
      <h1>{d.public.notFound.title}</h1>
      <p>{d.public.notFound.text}</p>
      <ButtonLink href="/" variant="primary">
        {d.home}
      </ButtonLink>
    </main>
  );
}
