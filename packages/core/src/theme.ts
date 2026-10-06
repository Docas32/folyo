import { templateSchema } from './templates';
import { z } from 'zod';
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const themeSchema = z
  .object({
    preset: templateSchema.default('blank'),
    accent: hexColorSchema.default('#16161D'),
    backgroundColor: hexColorSchema.nullable().default(null),
    textColor: hexColorSchema.nullable().default(null),
    contentWidth: z
      .enum(['auto', 'narrow', 'balanced', 'wide'])
      .default('auto'),
    sectionSpacing: z
      .enum(['auto', 'compact', 'comfortable', 'spacious'])
      .default('auto'),
    galleryLayout: z
      .enum(['auto', 'grid', 'two', 'editorial', 'featured'])
      .default('auto'),
    cornerStyle: z.enum(['auto', 'square', 'soft', 'rounded']).default('auto'),
    heroStyle: z.enum(['auto', 'plain', 'panel', 'editorial']).default('auto'),
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
export const PRESET_COLORS = {
  blank: { background: '#faf9f6', text: '#16161d' },
  minimal: { background: '#f3ede3', text: '#30291f' },
  professional: { background: '#f0f4f8', text: '#16161d' },
  creative: { background: '#fff3e9', text: '#3e241b' },
  executive: { background: '#f1ece3', text: '#302b24' },
  studio: { background: '#f6f1ff', text: '#281c3e' },
  scientist: { background: '#eff5f1', text: '#173a30' },
  developer: { background: '#101c2e', text: '#eff5ff' },
} as const;
function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
export function themeColors(value: unknown) {
  const theme = resolveTheme(value);
  const defaults = PRESET_COLORS[theme.preset];
  const background = theme.backgroundColor ?? defaults.background;
  const text =
    theme.textColor ??
    (theme.backgroundColor
      ? luminance(background) > 0.179
        ? '#16161d'
        : '#eff5ff'
      : defaults.text);
  return { background, text };
}
export function themeToStyle(value: unknown) {
  const theme = resolveTheme(value);
  const { background, text } = themeColors(theme);
  return {
    '--site-accent': theme.accent,
    '--site-hero-layout': theme.heroLayout,
    '--site-heading-font': fonts[theme.headingFont],
    '--site-body-font': fonts[theme.bodyFont],
    '--site-paper': background,
    '--site-ink': text,
    '--site-muted': `color-mix(in srgb, ${text} 75%, ${background})`,
    '--site-line': `color-mix(in srgb, ${text} 18%, ${background})`,
    '--site-surface': `color-mix(in srgb, ${background} 92%, ${text})`,
    '--site-content-width': {
      auto: theme.preset === 'minimal' ? '780px' : '1080px',
      narrow: '720px',
      balanced: '960px',
      wide: '1200px',
    }[theme.contentWidth],
    '--site-block-gap': {
      auto: '32px',
      compact: '16px',
      comfortable: '32px',
      spacious: '56px',
    }[theme.sectionSpacing],
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
// The same primitives validate persisted themes and their partial updates.
export const themePatchSchema = themeSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type ThemePatch = z.infer<typeof themePatchSchema>;
