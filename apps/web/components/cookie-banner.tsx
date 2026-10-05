'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from './ui/button';
import type { Dictionary } from '../lib/i18n';
export const COOKIE_CHOICE = 'folyo-cookie-choice';
export function CookieBanner({
  d,
}: {
  d: { privacyLink: string; public: Pick<Dictionary['public'], 'cookies'> };
}) {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(
      !document.cookie
        .split(';')
        .some((value) =>
          /^folyo-cookie-choice=(all|essential)$/.test(value.trim()),
        ),
    );
  }, []);
  if (!visible || path === '/p' || path?.startsWith('/p/')) return null;
  function choose(value: 'all' | 'essential') {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${COOKIE_CHOICE}=${value}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setVisible(false);
  }
  const c = d.public.cookies;
  return (
    <aside className="cookie-banner" aria-label={c.label}>
      <p>
        {c.text} <Link href="/privacy">{d.privacyLink}</Link>
      </p>
      <div>
        <Button size="sm" onClick={() => choose('all')}>
          {c.accept}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => choose('essential')}>
          {c.essential}
        </Button>
      </div>
    </aside>
  );
}
