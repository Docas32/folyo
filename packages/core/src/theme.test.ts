import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  resolveTheme,
  themeSchema,
  themeToCssVars,
  themeColors,
  themePatchSchema,
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

describe('template theme defaults', () => {
  it('defaults old persisted themes to centered heroes', () => {
    expect(resolveTheme({ accent: '#1E5AA8' }).heroLayout).toBe('center');
    expect(
      themeToCssVars({ heroLayout: 'left', headingFont: 'space-grotesk' }),
    ).toContain('--site-hero-layout: left;');
    expect(themeToCssVars({ headingFont: 'space-grotesk' })).toContain(
      '--font-space-grotesk',
    );
  });
});

describe('custom site design', () => {
  it('preserves legacy preset colors and supplies readable text for custom backgrounds', () => {
    expect(themeColors({ preset: 'developer' })).toEqual({
      background: '#101c2e',
      text: '#eff5ff',
    });
    expect(
      themeColors({ preset: 'developer', backgroundColor: '#fff3e9' }).text,
    ).toBe('#16161d');
    expect(themeColors({ backgroundColor: '#142138' }).text).toBe('#eff5ff');
  });
  it('round trips custom controls into the same publication variables', () => {
    const theme = themeSchema.parse({
      backgroundColor: '#f2c9dc',
      textColor: '#281622',
      contentWidth: 'wide',
      sectionSpacing: 'spacious',
    });
    expect(themeSchema.parse(JSON.parse(JSON.stringify(theme)))).toEqual(theme);
    const css = themeToCssVars(theme);
    expect(css).toContain('--site-paper: #f2c9dc;');
    expect(css).toContain('--site-ink: #281622;');
    expect(css).toContain('--site-content-width: 1200px;');
    expect(css).toContain('--site-block-gap: 56px;');
    expect(themePatchSchema.parse({ backgroundColor: null })).toEqual({
      backgroundColor: null,
    });
  });
});
