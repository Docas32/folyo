import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  resolveTheme,
  themeSchema,
  themeToCssVars,
} from './theme';
describe('site theme', () => {
  it('uses the blank default for empty stored themes', () => {
    expect(themeSchema.parse({})).toEqual(DEFAULT_THEME);
    expect(themeToCssVars({})).toContain('--site-accent: #16161D;');
  });
  it('maps validated font names and hex accents to CSS custom properties', () => {
    const css = themeToCssVars({
      preset: 'blank',
      accent: '#FF5c38',
      headingFont: 'lora',
      bodyFont: 'source-sans',
    });
    expect(css).toContain('--site-accent: #FF5c38;');
    expect(css).toContain('--site-heading-font: var(--font-lora');
    expect(css).toContain('--site-body-font: var(--font-source-sans');
    expect(
      themeToCssVars({ ...DEFAULT_THEME, headingFont: 'playfair' }),
    ).toContain('--font-playfair');
  });
  it.each([
    null,
    'broken',
    { accent: 'red' },
    { accent: '#fff; background:url(x)' },
    { headingFont: 'evil' },
    { preset: 'other' },
    { extra: true },
  ])('falls back completely for a corrupt theme: %j', (value) => {
    expect(resolveTheme(value)).toEqual(DEFAULT_THEME);
    expect(themeToCssVars(value)).toBe(themeToCssVars(DEFAULT_THEME));
  });
});
