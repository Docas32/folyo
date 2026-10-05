import { describe, expect, it } from 'vitest';
import { renderRobots, renderSitemap } from './seo';
import { renderPageHtml } from './render-page';
const pages = [
  { id: 'home', title: 'Home', slug: 'home' },
  { id: 'about', title: 'About', slug: 'about' },
];
const opts = {
  appUrl: 'https://app.folyo.example',
  publicUrl: 'https://maria.folyo.example',
  version: 1,
};
describe('published SEO snapshot', () => {
  it('renders robots and absolute sitemap URLs with a consistent lastmod', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(renderRobots(opts.publicUrl)).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://maria.folyo.example/sitemap.xml\n',
    );
    const xml = renderSitemap(opts.publicUrl, pages, now);
    expect(xml).toContain('<loc>https://maria.folyo.example/</loc>');
    expect(xml).toContain('<loc>https://maria.folyo.example/about</loc>');
    expect(xml.match(/2026-10-04T12:00:00.000Z/g)).toHaveLength(2);
  });
  it.each([null, 'assets/owner/icon.svg'])(
    'uses an absolute favicon and report footer, with indexable static HTML',
    async (faviconKey) => {
      const html = await renderPageHtml(
        {
          id: 'site',
          handle: 'maria',
          title: 'Maria',
          description: 'A portfolio',
          locale: 'en',
          faviconKey,
        },
        pages[0]!,
        [],
        pages,
        {},
        opts,
      );
      expect(html).toContain(
        `href="https://app.folyo.example/${faviconKey ? 'api/assets/' + faviconKey : 'favicon.svg'}"`,
      );
      expect(html).toContain('name="robots" content="index,follow"');
      expect(html).toContain(
        'href="https://app.folyo.example/report?site=maria"',
      );
      expect(html).toContain('Report this site');
      expect(html).not.toContain('folyo-cookie-choice');
      expect(html).not.toContain('<script');
      expect(Buffer.byteLength(html)).toBeLessThan(100 * 1024);
    },
  );
});
