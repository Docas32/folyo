import { templateAssetUrlSchema } from './templates';
import { z } from 'zod';
import { assetUrlSchema, MAX_PAGES } from './editor-management';
import { getBlockPlaceholders } from './block-placeholders';
import { normalizeExternalUrl } from './external-url';
export const MAX_BLOCKS = 100;
export const MAX_GALLERY_ITEMS = 12;
export const MAX_SOCIAL_LINKS = 10;
export const BLOCK_TYPES = [
  'hero',
  'heading',
  'text',
  'image',
  'gallery',
  'button',
  'social',
  'divider',
  'spacer',
] as const;
export const blockTypeSchema = z.enum(BLOCK_TYPES);
// Only external HTTP(S) URLs can become previews or public navigation targets.
export const externalUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value));
export const heroContentSchema = z
  .object({
    name: z.string().min(1).max(80),
    title: z.string().max(120),
    subtitle: z.string().max(200).optional(),
    avatarUrl: z
      .union([externalUrlSchema, assetUrlSchema, templateAssetUrlSchema])
      .optional(),
  })
  .strict();
export const headingContentSchema = z
  .object({
    text: z.string().min(1).max(120),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();
// Plain text, never HTML markup: consumers render it as escaped text.
export const textContentSchema = z
  .object({ text: z.string().max(5000) })
  .strict();
export const imageUrlSchema = z.union([
  externalUrlSchema,
  assetUrlSchema,
  templateAssetUrlSchema,
]);
export const imageContentSchema = z
  .object({
    url: imageUrlSchema,
    alt: z.string().min(1).max(200),
    caption: z.string().max(200).optional(),
  })
  .strict();
export const galleryItemSchema = z
  .object({
    url: imageUrlSchema,
    alt: z.string().min(1).max(200),
    caption: z.string().optional(),
  })
  .strict();
export const galleryContentSchema = z
  .object({ items: z.array(galleryItemSchema).min(1).max(MAX_GALLERY_ITEMS) })
  .strict();
const navigationUrlSchema = z.string().transform((value, context) => {
  if (value.trim() === '#') return '#';
  const normalized = normalizeExternalUrl(value);
  if (!normalized)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid external URL',
    });
  return normalized ?? value;
});
export const buttonContentSchema = z
  .object({
    label: z.string().min(1).max(60),
    url: navigationUrlSchema,
    style: z.enum(['primary', 'outline']),
  })
  .strict();
export const SOCIAL_PLATFORMS = [
  'linkedin',
  'instagram',
  'github',
  'x',
  'tiktok',
  'youtube',
  'whatsapp',
  'email',
  'site',
] as const;
export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS);
// Social URLs remain strings (email/WhatsApp included); F4 must select safe
// protocols per platform before turning these values into links.
export const socialContentSchema = z
  .object({
    layout: z.enum(['row', 'column']).default('row'),
    align: z.enum(['start', 'center', 'end']).default('start'),
    links: z
      .array(
        z
          .object({
            platform: socialPlatformSchema,
            url: z
              .string()
              .transform((value) => normalizeExternalUrl(value) ?? value),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_SOCIAL_LINKS),
  })
  .strict();
export const dividerContentSchema = z.object({}).strict();
export const spacerContentSchema = z
  .object({ height: z.enum(['sm', 'md', 'lg']) })
  .strict();
const variants = [
  z.object({ type: z.literal('hero'), content: heroContentSchema }).strict(),
  z
    .object({ type: z.literal('heading'), content: headingContentSchema })
    .strict(),
  z.object({ type: z.literal('text'), content: textContentSchema }).strict(),
  z.object({ type: z.literal('image'), content: imageContentSchema }).strict(),
  z
    .object({ type: z.literal('gallery'), content: galleryContentSchema })
    .strict(),
  z
    .object({ type: z.literal('button'), content: buttonContentSchema })
    .strict(),
  z
    .object({ type: z.literal('social'), content: socialContentSchema })
    .strict(),
  z
    .object({ type: z.literal('divider'), content: dividerContentSchema })
    .strict(),
  z
    .object({ type: z.literal('spacer'), content: spacerContentSchema })
    .strict(),
] as const;
export const blockContentSchema = z.discriminatedUnion('type', variants);
export type BlockContent = z.infer<typeof blockContentSchema>;
export type BlockType = BlockContent['type'];
export function normalizeBlockLinks<T extends BlockContent>(block: T): T {
  if (block.type === 'button') {
    const url =
      block.content.url.trim() === '#'
        ? '#'
        : normalizeExternalUrl(block.content.url);
    if (url && url !== block.content.url)
      return { ...block, content: { ...block.content, url } } as T;
  }
  if (block.type === 'social') {
    const links = block.content.links.map((link) => ({
      ...link,
      url: normalizeExternalUrl(link.url) ?? link.url,
    }));
    if (links.some((link, i) => link.url !== block.content.links[i]!.url))
      return { ...block, content: { ...block.content, links } } as T;
  }
  return block;
}
export type ContentByType = {
  [T in BlockType]: Extract<BlockContent, { type: T }>['content'];
};
export function createDefaultBlock<T extends BlockType>(
  type: T,
  locale: string,
): ContentByType[T] {
  const p = getBlockPlaceholders(locale);
  const defaults: ContentByType = {
    hero: { name: p.name, title: p.title, subtitle: p.subtitle },
    heading: { text: p.heading, level: 2 },
    text: { text: p.text },
    image: {
      url: 'https://placehold.co/1200x800',
      alt: p.alt,
      caption: p.caption,
    },
    gallery: {
      items: [
        {
          url: 'https://placehold.co/1200x800',
          alt: p.alt,
          caption: p.caption,
        },
      ],
    },
    button: { label: p.button, url: 'https://example.com', style: 'primary' },
    social: {
      layout: 'row',
      align: 'start',
      links: [{ platform: 'site', url: 'https://example.com' }],
    },
    divider: {},
    spacer: { height: 'md' },
  };
  return defaults[type];
}
const identity = {
  id: z.string().uuid(),
  position: z
    .number()
    .int()
    .min(0)
    .max(MAX_BLOCKS - 1),
};
export const editorBlockSchema = z.discriminatedUnion('type', [
  variants[0].extend(identity),
  variants[1].extend(identity),
  variants[2].extend(identity),
  variants[3].extend(identity),
  variants[4].extend(identity),
  variants[5].extend(identity),
  variants[6].extend(identity),
  variants[7].extend(identity),
  variants[8].extend(identity),
]);
export type EditorBlock = z.infer<typeof editorBlockSchema>;
export const saveBlocksSchema = z
  .object({ blocks: z.array(editorBlockSchema).max(MAX_BLOCKS) })
  .strict()
  .superRefine(({ blocks }, context) => {
    const seen = new Set<string>();
    blocks.forEach((block, index) => {
      if (block.type === 'social')
        block.content.links.forEach((link, linkIndex) => {
          if (!normalizeExternalUrl(link.url))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['blocks', index, 'content', 'links', linkIndex, 'url'],
              message: 'Invalid external URL',
            });
        });
      if (seen.has(block.id))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blocks', index, 'id'],
          message: 'Duplicate block ID',
        });
      if (block.position !== index)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blocks', index, 'position'],
          message: 'Position must match array order',
        });
      seen.add(block.id);
    });
  });
export const editorPageSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  position: z.number().int(),
});
export const documentBlockSchema = z.discriminatedUnion('type', [
  variants[0].extend({ ...identity, pageId: z.string().uuid() }),
  variants[1].extend({ ...identity, pageId: z.string().uuid() }),
  variants[2].extend({ ...identity, pageId: z.string().uuid() }),
  variants[3].extend({ ...identity, pageId: z.string().uuid() }),
  variants[4].extend({ ...identity, pageId: z.string().uuid() }),
  variants[5].extend({ ...identity, pageId: z.string().uuid() }),
  variants[6].extend({ ...identity, pageId: z.string().uuid() }),
  variants[7].extend({ ...identity, pageId: z.string().uuid() }),
  variants[8].extend({ ...identity, pageId: z.string().uuid() }),
]);
export const editorDocumentSchema = z.object({
  site: z.object({
    id: z.string().uuid(),
    handle: z.string(),
    title: z.string().nullable(),
    status: z.enum(['draft', 'published']),
  }),
  pages: z.array(editorPageSchema).min(1).max(MAX_PAGES),
  blocks: z.array(documentBlockSchema).max(MAX_BLOCKS * MAX_PAGES),
});
export type EditorPage = z.infer<typeof editorPageSchema>;
export type EditorDocument = z.infer<typeof editorDocumentSchema>;
export const blocksSavedSchema = z.object({
  ok: z.literal(true),
  savedAt: z.string().datetime(),
});
export const blocksSaveErrorSchema = z.object({
  error: z.string(),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        code: z.string(),
      }),
    )
    .optional(),
});
export { getBlockPlaceholders } from './block-placeholders';
