import { existsSync, readFileSync } from 'node:fs';
import { getDictionary } from './i18n';
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_IDS,
  BLOCK_TYPES,
  MAX_PAGES,
  templateAssetUrlSchema,
  blockContentSchema,
  themeSchema,
  createDefaultBlock,
  getBlockPlaceholders,
} from '@folyo/core';
import {
  buildTemplate,
  buildShowcaseTemplate,
  SHOWCASE_IDS,
  isVirginSite,
} from './templates';
const site = { title: null, description: null, status: 'draft' };
describe('localized templates', () => {
  it.each(['pt-BR', 'en'])(
    'builds complete, validated templates for %s',
    (locale) => {
      for (const id of TEMPLATE_IDS) {
        const template = buildTemplate(id, locale);
        expect(themeSchema.safeParse(template.theme).success).toBe(true);
        expect(template.pages).toHaveLength(
          id === 'blank'
            ? 1
            : id === 'minimal'
              ? 2
              : ['professional', 'creative'].includes(id)
                ? 3
                : 5,
        );
        expect(new Set(template.pages.map((page) => page.slug)).size).toBe(
          template.pages.length,
        );
        for (const page of template.pages)
          for (const block of page.blocks)
            expect(
              blockContentSchema.safeParse(block).success,
              `${id}: ${block.type}`,
            ).toBe(true);
        expect(template.pages[0]!.title).toBe(
          locale === 'pt-BR' ? 'Início' : 'Home',
        );
        if (id !== 'blank')
          expect(template.pages[0]!.blocks[0]!.content).toMatchObject({
            name:
              id === 'executive' ||
              id === 'studio' ||
              id === 'scientist' ||
              id === 'developer'
                ? getDictionary(locale).templates.showcase[id].name
                : locale === 'pt-BR'
                  ? 'Marina Costa'
                  : 'Alex Morgan',
          });
      }
    },
  );
  it('includes specific layouts, galleries and localized paragraphs/lists', () => {
    expect(buildTemplate('minimal', 'pt-BR').theme).toMatchObject({
      headingFont: 'playfair',
      heroLayout: 'center',
    });
    expect(
      buildTemplate('minimal', 'en').pages[0]!.blocks[1]!.content,
    ).toMatchObject({ text: expect.stringContaining('\n\n') });
    expect(
      buildTemplate('professional', 'pt-BR').pages[1]!.blocks[1]!.content,
    ).toMatchObject({ text: expect.stringContaining('\n- ') });
    expect(buildTemplate('professional', 'en').theme).toMatchObject({
      headingFont: 'space-grotesk',
      heroLayout: 'left',
    });
    expect(
      buildTemplate('professional', 'pt-BR').pages[0]!.blocks[2]!.content,
    ).toMatchObject({ label: 'Baixar CV', url: '#' });
    expect(
      buildTemplate('creative', 'en').pages[0]!.blocks[1]!.content,
    ).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ alt: expect.any(String) }),
      ]),
    });
    expect(
      (
        buildTemplate('creative', 'en').pages[1]!.blocks[0]!.content as {
          items: unknown[];
        }
      ).items,
    ).toHaveLength(6);
  });
  it('returns independent documents for repeated calls', () => {
    const first = buildTemplate('creative', 'pt-BR');
    first.pages[0]!.title = 'changed';
    expect(buildTemplate('creative', 'pt-BR').pages[0]!.title).toBe('Início');
  });
});
describe('virgin site detection', () => {
  it('accepts a newly created site without bootstrap', () =>
    expect(isVirginSite(site, [], [])).toBe(true));
  it.each(['pt-BR', 'en'])(
    'accepts only untouched localized bootstrap (%s)',
    (locale) => {
      const p = getBlockPlaceholders(locale),
        page = { title: p.pageTitle, slug: p.pageSlug };
      const block = {
        type: 'hero',
        content: createDefaultBlock('hero', locale),
      };
      expect(isVirginSite(site, [page], [block])).toBe(true);
      expect(
        isVirginSite(
          site,
          [page],
          [{ ...block, content: { ...block.content, name: 'Edited' } }],
        ),
      ).toBe(false);
      expect(isVirginSite(site, [{ ...page, title: 'Edited' }], [block])).toBe(
        false,
      );
      expect(isVirginSite(site, [{ ...page, slug: 'edited' }], [block])).toBe(
        false,
      );
      expect(isVirginSite(site, [page, page], [block])).toBe(false);
      expect(isVirginSite(site, [page], [block, block])).toBe(false);
      expect(isVirginSite(site, [page], [])).toBe(false);
      expect(isVirginSite({ ...site, title: 'Edited' }, [page], [block])).toBe(
        false,
      );
      expect(
        isVirginSite({ ...site, description: 'Edited' }, [page], [block]),
      ).toBe(false);
      expect(
        isVirginSite({ ...site, status: 'published' }, [page], [block]),
      ).toBe(false);
      expect(
        isVirginSite({ ...site, faviconKey: 'custom' }, [page], [block]),
      ).toBe(false);
      expect(
        isVirginSite(
          site,
          [page],
          [{ type: 'text', content: { text: 'Edited' } }],
        ),
      ).toBe(false);
      expect(
        isVirginSite(
          site,
          [page],
          [
            {
              ...block,
              content: {
                ...block.content,
                avatarUrl: 'https://example.com/avatar.png',
              },
            },
          ],
        ),
      ).toBe(false);
      const reordered = {
        subtitle: block.content.subtitle,
        title: block.content.title,
        name: block.content.name,
      };
      expect(
        isVirginSite(site, [page], [{ ...block, content: reordered }]),
      ).toBe(true);
    },
  );
});

describe('showcase portfolios', () => {
  it.each(SHOWCASE_IDS)(
    '%s uses all block types across five complete localized pages',
    (id) => {
      for (const locale of ['pt-BR', 'en']) {
        const template = buildShowcaseTemplate(id, locale);
        expect(template.pages).toHaveLength(MAX_PAGES);
        const blocks = template.pages.flatMap((page) => page.blocks);
        expect(new Set(blocks.map((block) => block.type))).toEqual(
          new Set(BLOCK_TYPES),
        );
        expect(
          blocks
            .filter((block) => block.type === 'gallery')
            .map((block) => block.content.items.length),
        ).toEqual([3, 6]);
        expect(
          blocks.some(
            (block) =>
              block.type === 'text' &&
              block.content.text.includes(
                getDictionary(locale).templates.showcase.exampleNote,
              ),
          ),
        ).toBe(true);
        for (const block of blocks) {
          const images =
            block.type === 'gallery'
              ? block.content.items
              : block.type === 'image'
                ? [block.content]
                : [];
          for (const image of images) {
            expect(templateAssetUrlSchema.safeParse(image.url).success).toBe(
              true,
            );
            const path = new URL(`../public${image.url}`, import.meta.url);
            expect(existsSync(path)).toBe(true);
            const svg = readFileSync(path, 'utf8');
            expect(svg).toContain('viewBox="0 0 1200 900"');
            expect(svg).not.toMatch(/<script|<foreignObject/);
            expect(image.alt.length).toBeGreaterThan(12);
          }
        }
      }
    },
  );
  it.each([
    '/template-assets/../private.svg',
    '/template-assets/developer-7.svg',
    '/template-assets/custom.svg',
    '//evil.example/image.svg',
  ])('rejects arbitrary paths: %s', (path) => {
    expect(templateAssetUrlSchema.safeParse(path).success).toBe(false);
  });
});
