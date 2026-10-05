import { z } from 'zod';
export const MAX_PAGES = 5;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const imageMimeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const assetKeySchema = z
  .string()
  .regex(/^assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp|ico|svg)$/);
export const assetUrlSchema = z.string().refine((value) => {
  if (!value.startsWith('/api/assets/')) return false;
  return assetKeySchema.safeParse(value.slice('/api/assets/'.length)).success;
});
export const uploadMetadataSchema = z
  .object({
    width: z.coerce.number().int().min(1).max(1600),
    height: z.coerce.number().int().min(1).max(1600),
    alt: z.string().trim().min(1).max(200),
  })
  .strict();
export const uploadResultSchema = z.object({
  url: assetUrlSchema,
  assetId: z.string().uuid(),
});
export const pageTitleSchema = z
  .object({ title: z.string().trim().min(1).max(120) })
  .strict();
export const reorderPagesSchema = z
  .object({
    pageIds: z
      .array(z.string().uuid())
      .min(1)
      .max(MAX_PAGES)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export function slugify(title: string) {
  return (
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)
      .replace(/-$/, '') || 'page'
  );
}
