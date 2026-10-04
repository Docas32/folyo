import { describe, expect, it } from 'vitest';
import { buildPublicSiteUrl, publishEnvironmentSchema } from './environment';
const env = {
  ROOT_DOMAIN: 'lvh.me',
  ENVIRONMENT: 'dev' as const,
  APP_PUBLIC_URL: 'http://app.lvh.me:3000',
  SITE_EDGE_PORT: '8787',
};
describe('public site URL', () => {
  it('uses the Edge port, independently of the app origin or protocol', () => {
    expect(
      buildPublicSiteUrl('joao', publishEnvironmentSchema.parse(env)),
    ).toBe('http://joao.lvh.me:8787');
    expect(
      buildPublicSiteUrl(
        'joao',
        publishEnvironmentSchema.parse({
          ...env,
          APP_PUBLIC_URL: 'https://app.lvh.me:3000',
        }),
      ),
    ).toBe('http://joao.lvh.me:8787');
  });
  it('supports a configured dev Edge port and defaults old environments to 8787', () => {
    expect(
      buildPublicSiteUrl(
        'joao',
        publishEnvironmentSchema.parse({ ...env, SITE_EDGE_PORT: '9898' }),
      ),
    ).toBe('http://joao.lvh.me:9898');
    expect(
      buildPublicSiteUrl(
        'joao',
        publishEnvironmentSchema.parse({ ...env, SITE_EDGE_PORT: undefined }),
      ),
    ).toBe('http://joao.lvh.me:8787');
  });
  it.each(['prod', 'preview'] as const)(
    'uses HTTPS without a port in %s',
    (ENVIRONMENT) => {
      expect(
        buildPublicSiteUrl(
          'joao',
          publishEnvironmentSchema.parse({
            ...env,
            ROOT_DOMAIN: 'example.com',
            ENVIRONMENT,
            SITE_EDGE_PORT: '',
          }),
        ),
      ).toBe('https://joao.example.com');
      expect(
        buildPublicSiteUrl(
          'joao',
          publishEnvironmentSchema.parse({
            ...env,
            ROOT_DOMAIN: 'example.com',
            ENVIRONMENT,
          }),
        ),
      ).toBe('https://joao.example.com');
    },
  );
  it.each(['', '300000', '0', 'abc', '-1'])(
    'rejects an invalid dev Edge port %s',
    (SITE_EDGE_PORT) => {
      expect(
        publishEnvironmentSchema.safeParse({ ...env, SITE_EDGE_PORT }).success,
      ).toBe(false);
    },
  );
});
