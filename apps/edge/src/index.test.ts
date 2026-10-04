import { afterEach, describe, expect, it, vi } from 'vitest';
import app, { type Bindings } from './index';
const webFetch = vi.fn<Bindings['WEB']['fetch']>();
const list = vi.fn<R2Bucket['list']>();
const get = vi.fn<R2Bucket['get']>();
const kvGet = vi.fn<(key: string) => Promise<string | null>>();
const env: Bindings = {
  ROOT_DOMAIN: 'lvh.me',
  ENVIRONMENT: 'prod',
  SITE_KV: { get: kvGet } as unknown as KVNamespace,
  WEB: {
    fetch: webFetch,
  },
  ASSETS_BUCKET: {} as R2Bucket,
  SITES_BUCKET: {
    list,
    get,
  } as unknown as R2Bucket,
};
const gzip = async (text: string) =>
  new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),
    {
      headers: {
        'content-encoding': 'gzip',
      },
    },
  );
const request = (
  host: string,
  path = '/',
  bindings = env,
  headers: Record<string, string> = {},
) =>
  app.request(
    `http://localhost:8787${path}`,
    {
      headers: {
        host,
        ...headers,
      },
    },
    bindings,
  );
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
describe('host dispatch', () => {
  it('forwards app requests to the production service binding', async () => {
    webFetch.mockResolvedValue(new Response('Folyo'));
    const response = await request('app.lvh.me', '/dashboard?tab=sites');
    expect(await response.text()).toBe('Folyo');
    expect(webFetch).toHaveBeenCalledOnce();
    const forwarded = webFetch.mock.calls[0]?.[0];
    expect(forwarded).toBeInstanceOf(Request);
    expect((forwarded as Request).url).toContain('/dashboard?tab=sites');
  });
  it.each(['APP.LVH.ME', ' APP.LVH.ME:8787 '])(
    'normalizes app host %s',
    async (host) => {
      webFetch.mockResolvedValue(new Response('Folyo'));
      const response = await request(host);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Folyo');
      expect(webFetch).toHaveBeenCalledOnce();
    },
  );
  it('serves the same published snapshot with and without a port in Host', async () => {
    kvGet.mockResolvedValue(
      JSON.stringify({
        siteId: '20000000-0000-4000-8000-000000000002',
        version: 2,
      }),
    );
    get.mockImplementation(
      async () =>
        ({ body: new Response('<h1>Joao</h1>').body }) as R2ObjectBody,
    );
    for (const host of [
      'joao.lvh.me',
      'joao.lvh.me:8787',
      ' JOAO.LVH.ME:8787 ',
    ]) {
      const response = await request(host);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<h1>Joao</h1>');
      expect(kvGet).toHaveBeenLastCalledWith('site:joao');
      expect(get).toHaveBeenLastCalledWith(
        'sites/20000000-0000-4000-8000-000000000002/v2/index.html',
      );
    }
    expect(webFetch).not.toHaveBeenCalled();
  });
  it('proxies app requests to Next locally with path and query intact', async () => {
    const localFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request('app.lvh.me:8787', '/?test=1', {
      ...env,
      ENVIRONMENT: 'dev',
    });
    expect(await response.text()).toContain('Folyo');
    expect((localFetch.mock.calls[0]?.[0] as Request).url).toBe(
      'http://localhost:3000/?test=1',
    );
    expect(webFetch).not.toHaveBeenCalled();
  });
  it('asks the local Next upstream for an uncompressed body', async () => {
    const localFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    await request(
      'app.lvh.me:8787',
      '/',
      {
        ...env,
        ENVIRONMENT: 'dev',
      },
      {
        'accept-encoding': 'gzip, deflate, br',
      },
    );
    const forwarded = localFetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get('accept-encoding')).toBe('identity');
    expect(forwarded.headers.get('host')).toBeNull();
  });
  it('decompresses gzip from the local upstream when the client did not request it', async () => {
    const localFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(await gzip('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request('app.lvh.me:8787', '/', {
      ...env,
      ENVIRONMENT: 'dev',
    });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toBe('<h1>Folyo</h1>');
  });
  it('keeps gzip untouched when the client accepts it', async () => {
    const localFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(await gzip('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request(
      'app.lvh.me:8787',
      '/',
      {
        ...env,
        ENVIRONMENT: 'dev',
      },
      {
        'accept-encoding': 'gzip, deflate, br',
      },
    );
    expect(response.headers.get('content-encoding')).toBe('gzip');
  });
  it('serves the publication selected by KV without touching the app', async () => {
    kvGet.mockResolvedValue(
      JSON.stringify({
        siteId: '20000000-0000-4000-8000-000000000002',
        version: 3,
      }),
    );
    get.mockResolvedValue({
      body: new Response('<h1>Published</h1>').body,
    } as R2ObjectBody);
    const response = await request('maria.lvh.me');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<h1>Published</h1>');
    expect(kvGet).toHaveBeenCalledWith('site:maria');
    expect(get).toHaveBeenCalledWith(
      'sites/20000000-0000-4000-8000-000000000002/v3/index.html',
    );
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(response.headers.get('cache-control')).toBe('public,max-age=300');
    expect(webFetch).not.toHaveBeenCalled();
  });
  it.each(['pt-BR', 'en'])(
    'returns a neutral localized 404 on KV miss (%s)',
    async (language) => {
      kvGet.mockResolvedValue(null);
      const response = await request('maria.lvh.me', '/', env, {
        'accept-language': language,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe(
        language === 'en' ? 'Site not found' : 'Site não encontrado',
      );
      expect(get).not.toHaveBeenCalled();
    },
  );
  it('uses canonical page paths and versioned immutable CSS', async () => {
    kvGet.mockResolvedValue(
      JSON.stringify({
        siteId: '20000000-0000-4000-8000-000000000002',
        version: 3,
      }),
    );
    const redirect = await request('maria.lvh.me', '/about/');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe('/about');
    get.mockImplementation(
      async () => ({ body: new Response('snapshot').body }) as R2ObjectBody,
    );
    await request('maria.lvh.me', '/about');
    expect(get).toHaveBeenLastCalledWith(
      'sites/20000000-0000-4000-8000-000000000002/v3/about/index.html',
    );
    const css = await request('maria.lvh.me', '/site.css?v=2');
    expect(get).toHaveBeenLastCalledWith(
      'sites/20000000-0000-4000-8000-000000000002/v2/site.css',
    );
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(css.headers.get('cache-control')).toBe(
      'public,max-age=31536000,immutable',
    );
    expect(
      (await request('maria.lvh.me', '/site.css')).headers.get('cache-control'),
    ).toBe('public,max-age=300');
  });
  it('rejects malformed metadata, nested paths, traversal and missing objects', async () => {
    kvGet.mockResolvedValue('{bad');
    expect((await request('maria.lvh.me')).status).toBe(404);
    kvGet.mockResolvedValue(
      JSON.stringify({ siteId: '../../other', version: 1 }),
    );
    expect((await request('maria.lvh.me')).status).toBe(404);
    kvGet.mockResolvedValue(
      JSON.stringify({
        siteId: '20000000-0000-4000-8000-000000000002',
        version: 1,
      }),
    );
    get.mockResolvedValue(null);
    expect((await request('maria.lvh.me', '/missing')).status).toBe(404);
    expect((await request('maria.lvh.me', '/about/nested')).status).toBe(404);
    expect((await request('maria.lvh.me', '/site.css?v=2')).status).toBe(404);
  });
  it.each(['lvh.me', 'www.lvh.me'])('redirects %s to the app', async (host) => {
    const response = await request(host, '/?ref=home');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://app.lvh.me/?ref=home',
    );
  });
  it.each(['lvh.me:8787', ' LVH.ME:8787 '])(
    'preserves the edge port on local redirects for %s',
    async (host) => {
      const response = await request(host, '/', {
        ...env,
        ENVIRONMENT: 'dev',
      });
      expect(response.headers.get('location')).toBe('http://app.lvh.me:8787/');
    },
  );
  it.each([
    'example.com',
    'maria.lvh.me.evil.com',
    'foo.bar.lvh.me',
    'admin.lvh.me',
    '<script>.lvh.me',
  ])('rejects unknown or invalid host %s', async (host) => {
    expect((await request(host)).status).toBe(404);
  });
  it('lists the local R2 binding only on the dev app host', async () => {
    list.mockResolvedValue({
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    });
    const response = await request('app.lvh.me', '/__dev/r2', {
      ...env,
      ENVIRONMENT: 'dev',
    });
    expect(await response.json()).toEqual({
      ok: true,
      objects: [],
      truncated: false,
    });
    expect(list).toHaveBeenCalledWith({
      limit: 100,
    });
  });
  it('exposes /__dev/r2-health in dev and returns ok', async () => {
    list.mockResolvedValue({
      objects: [
        {
          key: 'test.txt',
          size: 42,
        } as R2Object,
      ],
      truncated: false,
      delimitedPrefixes: [],
    });
    const response = await request('app.lvh.me', '/__dev/r2-health', {
      ...env,
      ENVIRONMENT: 'dev',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      objects: [
        {
          key: 'test.txt',
          size: 42,
        },
      ],
      truncated: false,
    });
    expect(list).toHaveBeenCalledWith({
      limit: 100,
    });
  });
  it('exposes /__dev/r2-health on localhost in dev', async () => {
    list.mockResolvedValue({
      objects: [
        {
          key: 'file.html',
          size: 1024,
        } as R2Object,
      ],
      truncated: false,
      delimitedPrefixes: [],
    });
    const response = await request('localhost:8787', '/__dev/r2-health', {
      ...env,
      ENVIRONMENT: 'dev',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      objects: [
        {
          key: 'file.html',
          size: 1024,
        },
      ],
      truncated: false,
    });
    expect(list).toHaveBeenCalledWith({
      limit: 100,
    });
  });
  it('returns 404 for non-GET methods on /__dev/r2-health', async () => {
    const response = await app.request(
      'http://localhost:8787/__dev/r2-health',
      {
        method: 'POST',
        headers: {
          host: 'localhost:8787',
        },
      },
      {
        ...env,
        ENVIRONMENT: 'dev',
      },
    );
    expect(response.status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });
  it('does not expose the R2 diagnostic in production', async () => {
    webFetch.mockResolvedValue(
      new Response('not found', {
        status: 404,
      }),
    );
    expect((await request('app.lvh.me', '/__dev/r2')).status).toBe(404);
    expect((await request('app.lvh.me', '/__dev/r2-health')).status).toBe(404);
    expect((await request('localhost:8787', '/__dev/r2-health')).status).toBe(
      404,
    );
    expect(list).not.toHaveBeenCalled();
  });
  it('rejects invalid environment configuration', async () => {
    expect(
      (
        await request('app.lvh.me', '/', {
          ...env,
          ROOT_DOMAIN: 'https://invalid',
        })
      ).status,
    ).toBe(500);
  });
});
