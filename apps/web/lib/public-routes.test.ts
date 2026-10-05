import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./legal', () => ({ legalDictionary: vi.fn() }));
vi.mock('../auth', () => ({ signIn: vi.fn() }));
vi.mock('./runtime', () => ({
  reportsRepository: vi.fn(),
  previewRepository: vi.fn(),
}));
vi.mock('./preview-service', () => ({ readPreview: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw Error('redirect:' + path);
  },
  notFound: () => {
    throw Error('notFound');
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
import { accountContext } from './session';
import { legalDictionary } from './legal';
import { reportsRepository } from './runtime';
import { readPreview } from './preview-service';
import { AccountError } from './account-service';
import { mockRepository, site, user } from './fixtures.test-helper';
import Home, { generateMetadata as homeMetadata } from '../app/page';
import ReportsPage from '../app/admin/reports/page';
import { LegalPage } from '../components/legal-page';
import { generateMetadata as previewMetadata } from '../app/p/[siteId]/[[...slug]]/page';
import en from './i18n/en';
import pt from './i18n/pt-BR';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(legalDictionary).mockResolvedValue(en);
  vi.mocked(accountContext).mockRejectedValue(
    new AccountError('unauthorized', 401),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe('public server routes', () => {
  it('renders the real landing and social metadata to visitors', async () => {
    const html = renderToStaticMarkup(
      await Home({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain(en.public.tagline);
    expect(html).toContain(en.googleLogin);
    expect(html).toContain('/privacy');
    expect((await homeMetadata()).openGraph).toMatchObject({
      type: 'website',
      title: en.public.title,
    });
  });
  it('redirects an authenticated current user to the dashboard', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      user,
      site,
      repo: mockRepository(),
    });
    await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'redirect:/dashboard',
    );
  });
  it.each([en, pt])(
    'renders complete legal content in each locale',
    async (d) => {
      vi.mocked(legalDictionary).mockResolvedValue(d);
      for (const kind of ['terms', 'privacy'] as const) {
        const html = renderToStaticMarkup(await LegalPage({ kind }));
        expect(d.legal[kind]).toHaveLength(8);
        for (const section of d.legal[kind])
          expect(html).toContain(section.title);
        expect(html).toContain('Cloudflare');
        expect(html).toContain('Neon');
      }
    },
  );
  it('returns 404 for a non-admin without reading reports', async () => {
    const list = vi.fn();
    vi.mocked(reportsRepository).mockReturnValue({
      list,
      submit: vi.fn(),
      update: vi.fn(),
    });
    vi.mocked(accountContext).mockResolvedValue({
      user,
      site,
      repo: mockRepository(),
    });
    vi.stubEnv('ADMIN_EMAILS', 'other@example.com');
    await expect(
      ReportsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('notFound');
    expect(list).not.toHaveBeenCalled();
  });
  it('lists and filters reports only for an admin', async () => {
    const list = vi
      .fn()
      .mockResolvedValue([
        {
          id: site.id,
          handle: 'maria',
          reason: 'spam',
          details: 'Please review',
          status: 'open',
          createdAt: new Date('2026-10-04'),
        },
      ]);
    vi.mocked(reportsRepository).mockReturnValue({
      list,
      submit: vi.fn(),
      update: vi.fn(),
    });
    vi.mocked(accountContext).mockResolvedValue({
      user,
      site,
      repo: mockRepository(),
    });
    vi.stubEnv('ADMIN_EMAILS', user.email);
    const html = renderToStaticMarkup(
      await ReportsPage({ searchParams: Promise.resolve({ status: 'open' }) }),
    );
    expect(list).toHaveBeenCalledWith('open');
    expect(html).toContain('Please review');
    expect(html).toContain(pt.public.admin.reviewed);
  });
  it('makes preview metadata noindex', async () => {
    vi.mocked(readPreview).mockResolvedValue({
      site: { ...site, title: 'Portfolio', locale: 'en' },
      pages: [],
      active: undefined,
      blocks: [],
    });
    expect(
      (await previewMetadata({ params: Promise.resolve({ siteId: site.id }) }))
        .robots,
    ).toEqual({ index: false, follow: false });
  });
});
