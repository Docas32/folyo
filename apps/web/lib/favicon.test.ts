import { describe, expect, it } from 'vitest';
import { MAX_FAVICON_BYTES, validateFavicon } from './favicon';
const bytes = (text: string) => new TextEncoder().encode(text);
describe('favicon validation', () => {
  it('accepts a static vector icon', () =>
    expect(
      validateFavicon(
        bytes(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M0 0h64v64Z" fill="#FF5C38"/></svg>',
        ),
        'image/svg+xml',
      ),
    ).toEqual({ ext: 'svg', mime: 'image/svg+xml' }));
  it.each([
    '<script>alert(1)</script>',
    '<foreignObject/>',
    '<image href="https://evil.example"/>',
    '<path onload="alert(1)"/>',
    '<style>path{fill:url(https://evil.example)}</style>',
    '<path fill="url(https://evil.example)"/>',
  ])('rejects active SVG %s', (text) =>
    expect(() =>
      validateFavicon(
        bytes(`<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>`),
        'image/svg+xml',
      ),
    ).toThrow(),
  );
  it('rejects excessive files, wrong MIME and invalid UTF-8', () => {
    expect(() =>
      validateFavicon(new Uint8Array(MAX_FAVICON_BYTES + 1), 'image/png'),
    ).toThrow();
    expect(() => validateFavicon(bytes('not png'), 'image/png')).toThrow();
    expect(() =>
      validateFavicon(new Uint8Array([255]), 'image/svg+xml'),
    ).toThrow();
  });
});
