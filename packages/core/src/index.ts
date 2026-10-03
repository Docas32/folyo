import { z } from 'zod';
export const RESERVED_HANDLES = [
  'www',
  'app',
  'admin',
  'api',
  'mail',
  'suporte',
  'support',
  'help',
  'about',
  'blog',
  'status',
  'docs',
  'folyo',
  'folio',
  'dashboard',
  'editor',
  'login',
  'signup',
  'auth',
  'static',
  'assets',
  'cdn',
  'dev',
  'test',
  'preview',
  'staging',
] as const;
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,30}$/)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/);
export const availableHandleSchema = handleSchema.refine(
  (handle) => !RESERVED_HANDLES.some((reserved) => reserved === handle),
  'Reserved handle',
);
export const templateSchema = z.enum([
  'blank',
  'minimal',
  'professional',
  'creative',
]);
export const siteStatusSchema = z.enum(['draft', 'published']);
export const blockTypeSchema = z.enum([
  'hero',
  'heading',
  'text',
  'image',
  'gallery',
  'button',
  'social',
  'divider',
  'spacer',
]);
export const environmentSchema = z.object({
  ROOT_DOMAIN: z
    .string()
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
  ENVIRONMENT: z.enum(['dev', 'preview', 'prod']),
});
export const databaseUrlSchema = z
  .string()
  .url()
  .refine((url) =>
    ['postgres:', 'postgresql:'].includes(new URL(url).protocol),
  );
export type TemplateId = z.infer<typeof templateSchema>;
export type SiteStatus = z.infer<typeof siteStatusSchema>;
export type BlockType = z.infer<typeof blockTypeSchema>;
// F5: replace this catalog with locale selection; components keep using keys.
export const messages = {
  'pt-BR': {
    brand: 'Folyo',
    comingSoon: (handle: string) => `Site de ${handle} — em breve`,
    notFound: 'Não encontrado',
    invalidEnvironment: 'Configuração inválida',
  },
};
export const defaultMessages = messages['pt-BR'];
