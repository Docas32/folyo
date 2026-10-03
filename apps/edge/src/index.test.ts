import { afterEach, describe, expect, it, vi } from 'vitest';
import app, { type Bindings } from './index';
const webFetch = vi.fn<Bindings['WEB']['fetch']>();
const list = vi.fn<R2Bucket['list']>();
const env: Bindings = {
  ROOT_DOMAIN: 'lvh.me',
  ENVIRONMENT: 'prod',
  WEB: {
    fetch: webFetch
  },
  ASSETS_BUCKET: ({} as R2Bucket),
  SITES_BUCKET: (({
    list
  } as unknown) as R2Bucket)
};
const gzip = async (text: string) => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')), {
  headers: {
    'content-encoding': 'gzip'
  }
});
const request = (host: string, path = '/', bindings = env, headers: Record<string, string> = {}) => app.request(`http://localhost:8787${path}`, {
  headers: {
    host,
    ...headers
  }
}, bindings);
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
  it('proxies app requests to Next locally with path and query intact', async () => {
    const localFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request('app.lvh.me:8787', '/?test=1', {
      ...env,
      ENVIRONMENT: 'dev'
    });
    expect(await response.text()).toContain('Folyo');
    expect((localFetch.mock.calls[0]?.[0] as Request).url).toBe('http://localhost:3000/?test=1');
    expect(webFetch).not.toHaveBeenCalled();
  });
  it('asks the local Next upstream for an uncompressed body', async () => {
    const localFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    await request('app.lvh.me:8787', '/', {
      ...env,
      ENVIRONMENT: 'dev'
    }, {
      'accept-encoding': 'gzip, deflate, br'
    });
    const forwarded = localFetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get('accept-encoding')).toBe('identity');
    expect(forwarded.headers.get('host')).toBeNull();
  });
  it('decompresses gzip from the local upstream when the client did not request it', async () => {
    const localFetch = vi.fn<typeof fetch>().mockResolvedValue(await gzip('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request('app.lvh.me:8787', '/', {
      ...env,
      ENVIRONMENT: 'dev'
    });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toBe('<h1>Folyo</h1>');
  });
  it('keeps gzip untouched when the client accepts it', async () => {
    const localFetch = vi.fn<typeof fetch>().mockResolvedValue(await gzip('<h1>Folyo</h1>'));
    vi.stubGlobal('fetch', localFetch);
    const response = await request('app.lvh.me:8787', '/', {
      ...env,
      ENVIRONMENT: 'dev'
    }, {
      'accept-encoding': 'gzip, deflate, br'
    });
    expect(response.headers.get('content-encoding')).toBe('gzip');
  });
  it('returns the published-site placeholder', async () => {
    const response = await request('maria.lvh.me');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe('<h1>Site de maria — em breve</h1>');
  });
  it.each(['lvh.me', 'www.lvh.me'])('redirects %s to the app', async host => {
    const response = await request(host, '/?ref=home');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://app.lvh.me/?ref=home');
  });
  it('preserves the edge port on local redirects', async () => {
    const response = await request('lvh.me:8787', '/', {
      ...env,
      ENVIRONMENT: 'dev'
    });
    expect(response.headers.get('location')).toBe('http://app.lvh.me:8787/');
  });
  it.each(['example.com', 'maria.lvh.me.evil.com', 'foo.bar.lvh.me', 'admin.lvh.me', '<script>.lvh.me'])('rejects unknown or invalid host %s', async host => {
    expect((await request(host)).status).toBe(404);
  });
  it('lists the local R2 binding only on the dev app host', async () => {
    list.mockResolvedValue({
      objects: [],
      truncated: false,
      delimitedPrefixes: []
    });
    const response = await request('app.lvh.me', '/__dev/r2', {
      ...env,
      ENVIRONMENT: 'dev'
    });
    expect(await response.json()).toEqual({
      ok: true,
      objects: [],
      truncated: false
    });
    expect(list).toHaveBeenCalledWith({
      limit: 100
    });
  });
  it('exposes /__dev/r2-health in dev and returns ok', async () => {
    list.mockResolvedValue({
      objects: [{
        key: 'test.txt',
        size: 42
      } as R2Object],
      truncated: false,
      delimitedPrefixes: []
    });
    const response = await request('app.lvh.me', '/__dev/r2-health', {
      ...env,
      ENVIRONMENT: 'dev'
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      objects: [{
        key: 'test.txt',
        size: 42
      }],
      truncated: false
    });
    expect(list).toHaveBeenCalledWith({
      limit: 100
    });
  });
  it('does not expose the R2 diagnostic in production', async () => {
    webFetch.mockResolvedValue(new Response('not found', {
      status: 404
    }));
    expect((await request('app.lvh.me', '/__dev/r2')).status).toBe(404);
    expect((await request('app.lvh.me', '/__dev/r2-health')).status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });
  it('rejects invalid environment configuration', async () => {
    expect((await request('app.lvh.me', '/', {
      ...env,
      ROOT_DOMAIN: 'https://invalid'
    })).status).toBe(500);
  });
});
