import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('./session', () => ({ pageAccount: vi.fn() }));
vi.mock('./runtime', () => ({
  editorRepository: () => ({bootstrapAndRead: async () => ({pages: [], blocks: []})}),
  publishEnvironment: () => ({
    ROOT_DOMAIN: 'lvh.me',
    ENVIRONMENT: 'dev',
    SITE_EDGE_PORT: '8787',
    APP_PUBLIC_URL: 'http://app.lvh.me:3000',
  }),
}));
vi.mock('../components/forms', () => ({
  CopyLink: () => createElement('button', null, 'Copiar link'),
}));
vi.mock('../components/publication-actions', () => ({
  PublicationActions: () => null,
}));
vi.mock('../components/logout', () => ({ Logout: () => null }));
import Dashboard from '../app/dashboard/page';
import { pageAccount } from './session';
import { mockRepository, site, user } from './fixtures.test-helper';
describe('dashboard draft preview', () => {
  it('links directly to the site preview in a new tab', async () => {
    vi.mocked(pageAccount).mockResolvedValue({
      user,
      site: { ...site, handle: 'a'.repeat(30) },
      repo: mockRepository(),
    });
    const html = renderToStaticMarkup(await Dashboard());
    expect(html).toContain(
      `href="/p/${site.id}" target="_blank" rel="noopener noreferrer"`,
    );
    expect(html).toContain('Ver preview');
    expect(html).toContain(`href="http://${'a'.repeat(30)}.lvh.me:8787"`);
    expect(html).not.toContain('.lvh.me:3000');
    expect(html).toMatch(
      /<section>[\s\S]*class="dashboard-link-row"[\s\S]*class="dashboard-url"[\s\S]*<button>Copiar link<\/button>[\s\S]*Ver preview[\s\S]*<\/section>/,
    );
    const css = readFileSync(
      new URL('../app/globals.css', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/\.dashboard-link-row\s*\{\s*display: flex;/);
    expect(css).toMatch(
      /\.dashboard-url\s*\{\s*flex: 1;\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/,
    );
    expect(css).toMatch(
      /\.dashboard-link-row > :not\(\.dashboard-url\)\s*\{\s*flex-shrink: 0;/,
    );
  });
});
