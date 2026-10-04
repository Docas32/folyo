import { describe, expect, it } from 'vitest';
import { imageUrlSchema, slugify, uploadMetadataSchema } from './index';
describe('editor management contracts', () => {
  it('slugifies accents and punctuation with a nonempty fallback', () => {
    expect(slugify('  Projetos Ágeis! ')).toBe('projetos-ageis');
    expect(slugify('日本語')).toBe('page');
  });
  it('accepts app asset URLs only in image fields', () => {
    expect(
      imageUrlSchema.safeParse(
        '/api/assets/assets/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.webp',
      ).success,
    ).toBe(true);
    for (const url of [
      '/other/image.png',
      '//evil.example/image.png',
      '/api/assets/../secret',
      'javascript:alert(1)',
    ])
      expect(imageUrlSchema.safeParse(url).success).toBe(false);
  });
  it('validates client dimensions after compression', () => {
    expect(
      uploadMetadataSchema.parse({
        width: '1600',
        height: '800',
        alt: 'Photo',
      }),
    ).toEqual({ width: 1600, height: 800, alt: 'Photo' });
    expect(
      uploadMetadataSchema.safeParse({ width: 'NaN', height: 800, alt: '' })
        .success,
    ).toBe(false);
  });
});
