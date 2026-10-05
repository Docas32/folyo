import Link from 'next/link';
import type { Dictionary } from '../lib/i18n';
export function AppFooter({ d }: { d: Dictionary }) {
  return (
    <footer className="app-footer">
      <span>© Folyo {new Date().getUTCFullYear()}</span>
      <nav aria-label={d.public.footerNavigation}>
        <Link href="/terms">{d.termsLink}</Link>
        <Link href="/privacy">{d.privacyLink}</Link>
        <Link href="/report">{d.public.report.title}</Link>
      </nav>
    </footer>
  );
}
