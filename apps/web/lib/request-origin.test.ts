import { describe, expect, it } from 'vitest';
import { hasSameOrigin } from './request-origin';
function request(
  origin: string | undefined,
  host?: string,
  url = 'http://0.0.0.0:3000/api/site/publish',
) {
  const headers = new Headers();
  if (origin !== undefined) headers.set('origin', origin);
  if (host !== undefined) headers.set('host', host);
  return new Request(url, { method: 'POST', headers });
}
describe('mutation origin verification', () => {
  it.each([
    'app.lvh.me:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    '[::1]:3000',
  ])('accepts public Host %s with an internal listener URL', (host) => {
    expect(hasSameOrigin(request(`http://${host}`, host))).toBe(true);
  });
  it('keeps the URL fallback when the runtime has no Host header', () => {
    expect(
      hasSameOrigin(
        request(
          'http://localhost:3000',
          undefined,
          'http://localhost:3000/api/site/theme',
        ),
      ),
    ).toBe(true);
  });
  it.each([
    undefined,
    'null',
    'https://evil.example',
    'http://app.lvh.me:8787',
    'https://app.lvh.me:3000',
    'http://app.lvh.me:3000/path',
    'http://user@app.lvh.me:3000',
    'http://0.0.0.0:3000',
  ])('rejects invalid or foreign Origin %s', (origin) => {
    expect(hasSameOrigin(request(origin, 'app.lvh.me:3000'))).toBe(false);
  });
  it.each([
    '',
    'user@app.lvh.me:3000',
    'app.lvh.me:3000/path',
    'app.lvh.me:3000?x',
    'app.lvh.me:3000#x',
    'app.lvh.me:3000\\evil',
  ])('rejects malformed Host %s', (host) => {
    expect(hasSameOrigin(request('http://app.lvh.me:3000', host))).toBe(false);
  });
  it('does not trust a spoofed forwarded host', () => {
    const incoming = request(
      'https://evil.example',
      'app.folyo.me',
      'https://internal/api/site/theme',
    );
    incoming.headers.set('x-forwarded-host', 'evil.example');
    expect(hasSameOrigin(incoming)).toBe(false);
  });
  it('accepts HTTPS and standard port normalization', () => {
    expect(
      hasSameOrigin(
        request(
          'https://app.folyo.me',
          'app.folyo.me:443',
          'https://internal/api/site/theme',
        ),
      ),
    ).toBe(true);
  });
});
