import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '@folyo/core';
import {
  absoluteAssetUrl,
  renderPageHtml,
  renderSiteCss,
  type SnapshotBlock,
} from './render-page';
const site = {
  id: 'site',
  handle: 'maria',
  title: 'Maria <script>x</script>',
  description: 'Design & code',
  locale: 'pt-BR',
};
const pages = [
  { id: 'home', slug: 'inicio', title: 'Início' },
  { id: 'about', slug: 'sobre', title: 'Sobre' },
];
const blocks: SnapshotBlock[] = [
  {
    id: 'hero',
    pageId: 'home',
    position: 0,
    type: 'hero',
    content: {
      name: 'Maria',
      title: 'Designer',
      avatarUrl: '/api/assets/assets/avatar.webp',
    },
  },
  {
    id: 'text',
    pageId: 'about',
    position: 0,
    type: 'text',
    content: { text: '<script>alert(1)</script>\n[Work](https://ok)' },
  },
  {
    id: 'gallery',
    pageId: 'about',
    position: 1,
    type: 'gallery',
    content: {
      items: [{ url: '/api/assets/assets/gallery.webp', alt: 'Photo' }],
    },
  },
];
const opts = {
  appUrl: 'https://app.example.com',
  publicUrl: 'https://maria.example.com',
  version: 2,
};
describe('static page snapshot', () => {
  it('rebases old absolute app asset URLs while preserving external images', () => {
    expect(
      absoluteAssetUrl(
        'http://app.lvh.me:3000/api/assets/assets/photo.webp',
        'http://app.lvh.me:8787',
      ),
    ).toBe('http://app.lvh.me:8787/api/assets/assets/photo.webp');
    expect(
      absoluteAssetUrl(
        'https://images.example.com/api/assets/photo.webp',
        'http://app.lvh.me:8787',
      ),
    ).toBe('https://images.example.com/api/assets/photo.webp');
  });
  it('renders complete home HTML with relative navigation, metadata and absolute assets', async () => {
    const html = await renderPageHtml(
      site,
      pages[0]!,
      blocks,
      pages,
      DEFAULT_THEME,
      opts,
    );
    expect(html).toMatch(/^<!doctype html><html lang="pt-BR">/i);
    expect(html).toContain('href="./"');
    expect(html).toContain('href="./sobre"');
    expect(html).toContain('href="./site.css?v=2"');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('rel="canonical" href="https://maria.example.com/"');
    expect(html).toContain(
      'property="og:image" content="https://app.example.com/api/assets/assets/avatar.webp"',
    );
    expect(html).toContain(
      'src="https://app.example.com/api/assets/assets/avatar.webp"',
    );
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('Feito com Folyo');
    expect(html).not.toContain('/inicio');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<style>');
    expect(html).toContain(
      '<title>Maria &lt;script&gt;x&lt;/script&gt;</title>',
    );
  });
  it('renders subpages using shared renders, escaping and localized footer', async () => {
    const html = await renderPageHtml(
      { ...site, locale: 'en' },
      pages[1]!,
      blocks,
      pages,
      DEFAULT_THEME,
      opts,
    );
    expect(html).toContain(
      'rel="canonical" href="https://maria.example.com/sobre"',
    );
    expect(html).toContain(
      '<title>Sobre · Maria &lt;script&gt;x&lt;/script&gt;</title>',
    );
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      'src="https://app.example.com/api/assets/assets/gallery.webp"',
    );
    expect(html).toContain(
      'href="https://ok" target="_blank" rel="noopener noreferrer"',
    );
    expect(html).toContain('Made with Folyo');
  });
  it.each(['', '   ', 'javascript:alert(1)', 'not-a-url'])(
    'rejects an invalid app origin %s even on a page with no images',
    async (appUrl) => {
      await expect(
        renderPageHtml(site, pages[0]!, [], pages, DEFAULT_THEME, {
          ...opts,
          appUrl,
        }),
      ).rejects.toMatchObject({
        status: 400,
        code: appUrl.trim() ? 'publishAppUrlInvalid' : 'publishAppUrlRequired',
      });
    },
  );
  it('writes layout rules and theme variables to the shared stylesheet', () => {
    expect(renderSiteCss({ ...DEFAULT_THEME, accent: '#ff5c38' })).toContain(
      '--site-accent: #ff5c38;',
    );
    expect(renderSiteCss(DEFAULT_THEME)).toContain('.folyo-site .site-main');
  });
});

describe('complete template publication rendering', () => {
  it.each([
    'minimal',
    'professional',
    'creative',
    'executive',
    'studio',
    'scientist',
    'developer',
  ] as const)(
    'renders %s pages with the selected theme through shared renders',
    async (id) => {
      const { buildTemplate } = await import('../templates');
      const template = buildTemplate(id, 'pt-BR');
      const templatePages = template.pages.map((page, index) => ({
        id: `page-${index}`,
        title: page.title,
        slug: page.slug,
      }));
      for (const [index, page] of template.pages.entries()) {
        const renderPage = templatePages[index]!;
        const templateBlocks = page.blocks.map((block, position) => ({
          ...block,
          id: `block-${position}`,
          pageId: renderPage.id,
          position,
        }));
        const html = await renderPageHtml(
          site,
          renderPage,
          templateBlocks,
          templatePages,
          template.theme,
          {
            appUrl: 'https://app.folyo.me',
            publicUrl: 'https://maria.folyo.me',
            version: 1,
          },
        );
        expect(html).toContain(`--site-accent:${template.theme.accent}`);
        expect(html).toContain(
          `--site-hero-layout:${template.theme.heroLayout}`,
        );
        if (!index) {
          expect(html).toContain(
            (template.pages[0]!.blocks[0]!.content as { name: string }).name,
          );
          expect(html).toContain(`site-hero-${template.theme.heroLayout}`);
        }
        if (id === 'professional' && !index) {
          expect(html).toContain('Space+Grotesk');
          expect(html).toContain('href="#"');
        }
        if (
          ['executive', 'studio', 'scientist', 'developer'].includes(id) &&
          html.includes('template-assets/')
        ) {
          expect(html).toContain(`https://app.folyo.me/template-assets/${id}-`);
          expect(html).not.toContain('src="/template-assets/');
        }
        expect(html).not.toContain('<script');
      }
    },
  );
});
