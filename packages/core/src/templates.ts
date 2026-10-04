import { z } from 'zod';
import type { Theme } from './theme';
import type { BlockContent } from './blocks';
export const TEMPLATE_IDS = [
  'blank',
  'minimal',
  'professional',
  'creative',
  'executive',
  'studio',
  'scientist',
  'developer',
] as const;
export const templateSchema = z.enum(TEMPLATE_IDS);
export type TemplateId = z.infer<typeof templateSchema>;
export type TemplateDefinition = {
  theme: Theme;
  pages: { title: string; slug: string; blocks: BlockContent[] }[];
};
// First-party, immutable illustrations: arbitrary relative paths stay rejected.
export const templateAssetUrlSchema = z
  .string()
  .regex(
    /^\/template-assets\/(executive|studio|scientist|developer)-(cover|[1-6])\.svg$/,
  );
