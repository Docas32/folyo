import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('./runtime', () => ({ previewRepository: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
import Preview, { generateMetadata } from '../app/p/[siteId]/[[...slug]]/page';
import { previewRepository } from './runtime';
import { readPreview } from './preview-service';
import type { PreviewRepository } from './preview-repository';
const id = '10000000-0000-4000-8000-000000000001';
const home = {
  id: 'home',
  siteId: id,
  title: 'Início',
  slug: 'inicio',
  position: 0,
};
const work = {
  id: 'work',
  siteId: id,
  title: 'Projetos',
  slug: 'projetos',
  position: 1,
};
function document() {
  return {
    site: {
      id,
      title: 'Portfolio',
      description: 'Works',
      locale: 'pt-BR',
      theme: {},
    },
    pages: [work, home],
    blocks: [
      {
        id: 'last',
        pageId: home.id,
        position: 2,
        type: 'text' as const,
        content: { text: 'Last block' },
      },
      {
        id: 'work-block',
        pageId: work.id,
        position: 0,
        type: 'text' as const,
        content: { text: 'Work page only' },
      },
      {
        id: 'first',
        pageId: home.id,
        position: 0,
        type: 'heading' as const,
        content: { text: 'First block', level: 2 },
      },
    ],
  };
}
let data = document();
let read = vi.fn<PreviewRepository['read']>();
beforeEach(() => {
  data = document();
  read = vi
    .fn<PreviewRepository['read']>()
    .mockImplementation(async () => data);
  vi.mocked(previewRepository).mockReturnValue({ read });
});
const params = (slug?: string[]) =>
  Promise.resolve({ siteId: id, ...(slug ? { slug } : {}) });
async function markup(slug?: string[]) {
  return renderToStaticMarkup(await Preview({ params: params(slug) }));
}
describe('public draft preview route', () => {
  it('returns 404 for missing sites, bad UUIDs and unknown/nested slugs', async () => {
    read.mockResolvedValueOnce(undefined);
    await expect(Preview({ params: params() })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    await expect(
      Preview({ params: Promise.resolve({ siteId: 'invalid' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(Preview({ params: params(['missing']) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    await expect(
      Preview({ params: params(['inicio', 'extra']) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('renders blocks and page links in order, marks home/current and uses owner locale without a session', async () => {
    const html = await markup();
    expect(html.indexOf('First block')).toBeLessThan(
      html.indexOf('Last block'),
    );
    expect(html).not.toContain('Work page only');
    expect(html).toContain(
      `href="/p/${id}/inicio" aria-current="page" data-home="true"`,
    );
    expect(html.indexOf('>Início</a>')).toBeLessThan(
      html.indexOf('>Projetos</a>'),
    );
    expect(html).toContain('aria-label="Páginas do site"');
    expect(html).toContain('Feito com Folyo');
    expect(html).toContain('lang="pt-BR"');
    expect(read).toHaveBeenCalledWith(id);
  });
  it('navigates to the requested page without leaking blocks from another page', async () => {
    const html = await markup(['projetos']);
    expect(html).toContain('Work page only');
    expect(html).not.toContain('First block');
    expect(html).toContain(`href="/p/${id}/projetos" aria-current="page"`);
  });
  it('hides navigation for a single page and uses the English owner chrome', async () => {
    data.pages = [home];
    data.site.locale = 'en';
    const html = await markup();
    expect(html).not.toContain('<nav');
    expect(html).toContain('Made with Folyo');
  });
  it('rejects foreign sites and filters foreign pages/blocks defensively', async () => {
    data.pages.push({
      ...home,
      id: 'foreign',
      siteId: 'other',
      title: 'PRIVATE',
    });
    data.blocks.push({
      id: 'foreign-block',
      pageId: 'foreign',
      type: 'text',
      position: 0,
      content: { text: 'PRIVATE' },
    });
    expect(await markup()).not.toContain('PRIVATE');
    data.site.id = 'other';
    expect(await readPreview({ read }, id)).toBeUndefined();
  });
  it('generates draft-independent metadata and disables indexing', async () => {
    expect(await generateMetadata({ params: params() })).toEqual({
      title: 'Portfolio',
      description: 'Works',
      robots: { index: false, follow: false },
    });
  });
  it('can serialize the reusable component with corrupt themes and escaped content', async () => {
    data.site.theme = { accent: '<script>' };
    data.blocks[0]!.content = { text: '<script>alert(1)</script>' };
    const element = await Preview({ params: params() });
    const html = renderToStaticMarkup(
      createElement(element.type, element.props),
    );
    expect(html).toContain('--site-accent:#16161D');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
