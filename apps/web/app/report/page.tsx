import { legalDictionary } from '../../lib/legal';
import { ReportForm } from '../../components/report-form';
import { AppFooter } from '../../components/app-footer';
import { Logo } from '../../components/logo';
import Link from 'next/link';
export async function generateMetadata() {
  const d = await legalDictionary();
  return {
    title: `${d.public.report.title} · Folyo`,
    description: d.public.report.description,
    robots: { index: false },
  };
}
export default async function Report({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const d = await legalDictionary();
  const { site } = await searchParams;
  return (
    <main className="public-page">
      <Link href="/" aria-label={d.home}>
        <Logo />
      </Link>
      <h1>{d.public.report.title}</h1>
      <p>{d.public.report.description}</p>
      <ReportForm d={d} initialHandle={site ?? ''} />
      <AppFooter d={d} />
    </main>
  );
}
