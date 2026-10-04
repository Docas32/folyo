import { templateSchema } from './templates';
import { z } from 'zod';
export const themeSchema = z
  .object({
    preset: templateSchema.default('blank'),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#16161D'),
    headingFont: z
      .enum(['inter', 'playfair', 'space-grotesk', 'lora'])
      .default('inter'),
    heroLayout: z.enum(['center', 'left']).default('center'),
    bodyFont: z.enum(['inter', 'source-sans']).default('inter'),
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;
export const DEFAULT_THEME: Theme = themeSchema.parse({});
export function resolveTheme(value: unknown): Theme {
  const parsed = themeSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...DEFAULT_THEME };
}
const fonts = {
  inter: 'var(--font-inter, "Inter"), sans-serif',
  'space-grotesk': 'var(--font-space-grotesk, "Space Grotesk"), sans-serif',
  lora: 'var(--font-lora, "Lora"), serif',
  playfair: 'var(--font-playfair, "Playfair Display"), serif',
  'source-sans': 'var(--font-source-sans, "Source Sans 3"), sans-serif',
};
export function themeToStyle(value: unknown) {
  const theme = resolveTheme(value);
  return {
    '--site-accent': theme.accent,
    '--site-hero-layout': theme.heroLayout,
    '--site-heading-font': fonts[theme.headingFont],
    '--site-body-font': fonts[theme.bodyFont],
  };
}
export function themeToCssVars(value: unknown): string {
  return Object.entries(themeToStyle(value))
    .map(([key, val]) => `${key}: ${val};`)
    .join(' ');
}

export const ACCENT_PALETTE = [
  '#16161D',
  '#1E5AA8',
  '#0E9384',
  '#7C3AED',
  '#D97706',
  '#DC2626',
  '#FF5C38',
  '#0F766E',
] as const;
export const themePatchSchema = z
  .object({
    accent: z.enum(ACCENT_PALETTE).optional(),
    headingFont: themeSchema.shape.headingFont.removeDefault().optional(),
    bodyFont: themeSchema.shape.bodyFont.removeDefault().optional(),
    heroLayout: themeSchema.shape.heroLayout.removeDefault().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type ThemePatch = z.infer<typeof themePatchSchema>;
