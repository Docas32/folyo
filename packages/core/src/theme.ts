import { z } from 'zod';
export const themeSchema = z
  .object({
    preset: z.literal('blank').default('blank'),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#16161D'),
    headingFont: z.enum(['inter', 'lora', 'playfair']).default('inter'),
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
  lora: 'var(--font-lora, "Lora"), serif',
  playfair: 'var(--font-playfair, "Playfair Display"), serif',
  'source-sans': 'var(--font-source-sans, "Source Sans 3"), sans-serif',
};
export function themeToStyle(value: unknown) {
  const theme = resolveTheme(value);
  return {
    '--site-accent': theme.accent,
    '--site-heading-font': fonts[theme.headingFont],
    '--site-body-font': fonts[theme.bodyFont],
  };
}
export function themeToCssVars(value: unknown): string {
  return Object.entries(themeToStyle(value))
    .map(([key, val]) => `${key}: ${val};`)
    .join(' ');
}
