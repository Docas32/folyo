import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Landing } from './landing';
import { CookieBanner, COOKIE_CHOICE } from './cookie-banner';
import { ReportForm } from './report-form';
import en from '../lib/i18n/en';
import pt from '../lib/i18n/pt-BR';
let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
beforeEach(() => {
  pathname = '/';
  document.cookie = `${COOKIE_CHOICE}=; Path=/; Max-Age=0`;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = `${COOKIE_CHOICE}=; Path=/; Max-Age=0`;
});
describe('public product pages', () => {
  it.each([en, pt])(
    'renders localized landing hero, three features and legal footer',
    (d) => {
      render(
        <Landing
          d={d}
          locale={d.public.locale}
          login={<button>{d.googleLogin}</button>}
        />,
      );
      expect(
        screen.getByRole('heading', { level: 1, name: d.public.tagline }),
      ).toBeVisible();
      for (const feature of d.public.features)
        expect(
          screen.getByRole('heading', { name: feature.title }),
        ).toBeVisible();
      for (const link of screen.getAllByRole('link', { name: d.termsLink }))
        expect(link).toHaveAttribute('href', '/terms');
      expect(screen.getAllByRole('link', { name: d.privacyLink })).toHaveLength(
        2,
      );
      expect(
        screen.getByRole('img', { name: d.public.exampleLabel }),
      ).toBeVisible();
    },
  );
  it.each(['all', 'essential'])(
    'persists %s cookie choice across remounts',
    (choice) => {
      const view = render(<CookieBanner d={en} />);
      fireEvent.click(
        screen.getByRole('button', {
          name:
            choice === 'all'
              ? en.public.cookies.accept
              : en.public.cookies.essential,
        }),
      );
      expect(document.cookie).toContain(`${COOKIE_CHOICE}=${choice}`);
      expect(screen.queryByRole('complementary')).toBeNull();
      view.unmount();
      render(<CookieBanner d={en} />);
      expect(screen.queryByRole('complementary')).toBeNull();
    },
  );
  it('does not show an app cookie banner on public preview', () => {
    pathname = '/p/site';
    render(<CookieBanner d={en} />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });
  it('submits a localized public report without login', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    render(<ReportForm d={en} initialHandle="maria" />);
    fireEvent.change(
      screen.getByRole('textbox', { name: en.public.report.details }),
      { target: { value: 'Please review this page' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: en.public.report.submit }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      en.public.report.success,
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          handle: 'maria',
          reason: 'spam',
          details: 'Please review this page',
          website: '',
        }),
      }),
    );
  });
});
