import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  blockContentSchema,
  createDefaultBlock,
  getBlockPlaceholders,
  editorBlockSchema,
  saveBlocksSchema,
  type BlockType,
} from './blocks';
const id = '30000000-0000-4000-8000-000000000003';
describe('shared block schemas and defaults', () => {
  it.each(BLOCK_TYPES)(
    'validates localized %s defaults in both languages',
    (type) => {
      for (const locale of ['pt-BR', 'en']) {
        const content = createDefaultBlock(type, locale);
        expect(blockContentSchema.safeParse({ type, content }).success).toBe(
          true,
        );
        expect(
          editorBlockSchema.safeParse({ id, position: 0, type, content })
            .success,
        ).toBe(true);
      }
    },
  );
  it('uses Portuguese placeholders and English fallback', () => {
    expect(createDefaultBlock('hero', 'pt-BR').name).toBe(
      getBlockPlaceholders('pt-BR').name,
    );
    expect(createDefaultBlock('hero', 'other').name).toBe(
      getBlockPlaceholders('en').name,
    );
    expect(getBlockPlaceholders('pt-BR').pageSlug).toBe('inicio');
    expect(getBlockPlaceholders('en').pageSlug).toBe('home');
  });
  it('returns independent arrays for every new block', () => {
    const first = createDefaultBlock('gallery', 'en');
    first.items.splice(0, 1);
    expect(createDefaultBlock('gallery', 'en').items).toHaveLength(1);
  });
  const invalid: { type: BlockType; content: unknown }[] = [
    { type: 'hero', content: { name: '', title: '' } },
    { type: 'hero', content: { name: 'a'.repeat(81), title: '' } },
    { type: 'hero', content: { name: 'a', title: 'a'.repeat(121) } },
    {
      type: 'hero',
      content: { name: 'a', title: '', subtitle: 'a'.repeat(201) },
    },
    { type: 'hero', content: { name: 'a', title: '', avatarUrl: 'bad' } },
    { type: 'heading', content: { text: '', level: 1 } },
    { type: 'heading', content: { text: 'a'.repeat(121), level: 1 } },
    { type: 'heading', content: { text: 'abc', level: 4 } },
    { type: 'text', content: { text: 'a'.repeat(5001) } },
    { type: 'image', content: { url: 'invalid', alt: 'abc' } },
    { type: 'image', content: { url: 'https://example.com/img', alt: '' } },
    {
      type: 'image',
      content: { url: 'https://example.com/img', alt: 'a'.repeat(201) },
    },
    {
      type: 'image',
      content: {
        url: 'https://example.com/img',
        alt: 'abc',
        caption: 'a'.repeat(201),
      },
    },
    { type: 'gallery', content: { items: [] } },
    {
      type: 'gallery',
      content: {
        items: Array.from({ length: 13 }, () => ({
          url: 'https://example.com/img',
          alt: 'abc',
        })),
      },
    },
    { type: 'gallery', content: { items: [{ url: 'bad', alt: 'abc' }] } },
    {
      type: 'gallery',
      content: { items: [{ url: 'https://example.com/img', alt: '' }] },
    },
    {
      type: 'button',
      content: { label: '', url: 'https://example.com', style: 'primary' },
    },
    {
      type: 'button',
      content: {
        label: 'a'.repeat(61),
        url: 'https://example.com',
        style: 'primary',
      },
    },
    { type: 'button', content: { label: 'abc', url: 'bad', style: 'primary' } },
    {
      type: 'button',
      content: { label: 'abc', url: 'https://example.com', style: 'other' },
    },
    { type: 'social', content: { links: [] } },
    {
      type: 'social',
      content: {
        links: Array.from({ length: 11 }, () => ({
          platform: 'site',
          url: 'https://example.com',
        })),
      },
    },
    { type: 'social', content: { links: [{ platform: 'other', url: 'abc' }] } },
    { type: 'divider', content: { text: 'not empty' } },
    { type: 'spacer', content: { height: 'xl' } },
  ];
  it.each(invalid)('rejects invalid $type content', (value) => {
    expect(blockContentSchema.safeParse(value).success).toBe(false);
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com'])(
    'rejects unsafe preview/navigation URL %s',
    (url) => {
      expect(
        blockContentSchema.safeParse({
          type: 'image',
          content: { url, alt: 'Image' },
        }).success,
      ).toBe(false);
    },
  );
  it('accepts exact text limits and empty plain-text paragraphs', () => {
    expect(
      blockContentSchema.parse({ type: 'text', content: { text: '' } }),
    ).toBeDefined();
    expect(
      blockContentSchema.parse({
        type: 'text',
        content: { text: 'a'.repeat(5000) },
      }),
    ).toBeDefined();
    expect(
      blockContentSchema.parse({
        type: 'hero',
        content: {
          name: 'a'.repeat(80),
          title: 'a'.repeat(120),
          subtitle: 'a'.repeat(200),
        },
      }),
    ).toBeDefined();
    expect(
      blockContentSchema.parse({
        type: 'image',
        content: {
          url: 'https://example.com',
          alt: 'a'.repeat(200),
          caption: 'a'.repeat(200),
        },
      }),
    ).toBeDefined();
    expect(
      blockContentSchema.parse({
        type: 'button',
        content: {
          label: 'a'.repeat(60),
          url: 'https://example.com',
          style: 'outline',
        },
      }),
    ).toBeDefined();
  });
  it('accepts gallery and social list limits and their supported options', () => {
    expect(
      blockContentSchema.parse({
        type: 'gallery',
        content: {
          items: Array.from({ length: 12 }, () => ({
            url: 'https://example.com',
            alt: 'Image',
            caption: 'a'.repeat(500),
          })),
        },
      }),
    ).toBeDefined();
    expect(
      blockContentSchema.parse({
        type: 'social',
        content: {
          links: Array.from({ length: 10 }, () => ({
            platform: 'email',
            url: 'mailto:test@example.com',
          })),
        },
      }),
    ).toBeDefined();
    for (const level of [1, 2, 3])
      expect(
        blockContentSchema.safeParse({
          type: 'heading',
          content: { text: 'Title', level },
        }).success,
      ).toBe(true);
    for (const height of ['sm', 'md', 'lg'])
      expect(
        blockContentSchema.safeParse({ type: 'spacer', content: { height } })
          .success,
      ).toBe(true);
  });
  it('rejects mismatched discriminators and extra fields', () => {
    expect(
      blockContentSchema.safeParse({
        type: 'hero',
        content: { text: 'Heading', level: 1 },
      }).success,
    ).toBe(false);
    expect(
      blockContentSchema.safeParse({ type: 'divider', content: {}, pageId: id })
        .success,
    ).toBe(false);
  });
});
describe('full ordered block list', () => {
  const block = {
    id,
    type: 'text' as const,
    content: { text: 'Text' },
    position: 0,
  };
  it('accepts empty and 100-block pages', () => {
    expect(saveBlocksSchema.safeParse({ blocks: [] }).success).toBe(true);
    expect(
      saveBlocksSchema.safeParse({
        blocks: Array.from({ length: 100 }, (_, position) => ({
          ...block,
          id: `30000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
          position,
        })),
      }).success,
    ).toBe(true);
  });
  it('rejects more than 100 blocks, duplicate IDs, noncanonical positions and foreign fields', () => {
    expect(
      saveBlocksSchema.safeParse({
        blocks: Array.from({ length: 101 }, (_, position) => ({
          ...block,
          position,
        })),
      }).success,
    ).toBe(false);
    expect(
      saveBlocksSchema.safeParse({ blocks: [block, { ...block, position: 1 }] })
        .success,
    ).toBe(false);
    expect(
      saveBlocksSchema.safeParse({ blocks: [{ ...block, position: 1 }] })
        .success,
    ).toBe(false);
    expect(
      saveBlocksSchema.safeParse({ blocks: [{ ...block, pageId: id }] })
        .success,
    ).toBe(false);
  });
  it('reports the invalid field path including block index', () => {
    const result = saveBlocksSchema.safeParse({
      blocks: [{ ...block, type: 'image', content: { url: 'bad', alt: '' } }],
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual([
        'blocks',
        0,
        'content',
        'url',
      ]);
  });
});
