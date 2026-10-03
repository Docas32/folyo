import { Hono } from 'hono';
import { defaultMessages, environmentSchema, availableHandleSchema } from '@folyo/core';
export interface Bindings {
  ROOT_DOMAIN: string;
  ENVIRONMENT: string;
  WEB: Pick<Fetcher, 'fetch'>;
  ASSETS_BUCKET: R2Bucket;
  SITES_BUCKET: R2Bucket;
}
const app = new Hono<{
  Bindings: Bindings;
}>();
app.all('*', async c => {
  const parsed = environmentSchema.safeParse(c.env);
  if (!parsed.success) return c.text(defaultMessages.invalidEnvironment, 500);
  const {
    ROOT_DOMAIN,
    ENVIRONMENT
  } = parsed.data;
  // Host is used explicitly so local curl requests can exercise host dispatch.
  const authority = c.req.header('host') ?? new URL(c.req.url).host;
  if (!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(authority)) return c.text(defaultMessages.notFound, 404);
  const host = authority.toLowerCase().replace(/:[0-9]+$/, '');
  const url = new URL(c.req.url);
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    url.hostname = `app.${ROOT_DOMAIN}`;
    // Preserve the local edge port; production redirects always use HTTPS.
    if (ENVIRONMENT !== 'dev') {
      url.protocol = 'https:';
      url.port = '';
    } else {
      url.port = authority.split(':')[1] ?? url.port;
    }
    return c.redirect(url.toString(), 302);
  }
  if (host === `app.${ROOT_DOMAIN}` || (ENVIRONMENT === 'dev' && (host === 'localhost' || host === '127.0.0.1'))) {
    if (url.pathname === '/__dev/r2' || url.pathname === '/__dev/r2-health') {
      if (ENVIRONMENT !== 'dev' || c.req.method !== 'GET') {
        return c.text(defaultMessages.notFound, 404);
      }
      const listed = await c.env.SITES_BUCKET.list({
        limit: 100
      });
      return c.json({
        ok: true,
        objects: listed.objects.map(object => ({
          key: object.key,
          size: object.size
        })),
        truncated: listed.truncated
      });
    }
    if (ENVIRONMENT === 'dev') {
      url.protocol = 'http:';
      url.hostname = 'localhost';
      url.port = '3000';
      const request = new Request(url, c.req.raw);
      request.headers.delete('host');
      // Next's dev server compresses even when the client never asked for it, so the
      // upstream is always asked for an uncompressed body.
      request.headers.set('accept-encoding', 'identity');
      const response = await fetch(request);
      const clientAcceptsGzip = c.req.header('accept-encoding')?.includes('gzip') ?? false;
      if (clientAcceptsGzip || response.headers.get('content-encoding') !== 'gzip') return response;
      // Fallback: undo an unwanted gzip so plain clients (curl, fetch) get readable HTML.
      if (!response.body) return response;
      const headers = new Headers(response.headers);
      headers.delete('content-encoding');
      headers.delete('content-length');
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip')), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    return c.env.WEB.fetch(c.req.raw);
  }
  const suffix = `.${ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const handle = availableHandleSchema.safeParse(host.slice(0, -suffix.length));
    if (handle.success) {
      // TODO F4: resolve publication and serve SITES_BUCKET objects.
      // Validation restricts the handle to HTML-safe ASCII characters.
      return c.html(`<h1>${defaultMessages.comingSoon(handle.data)}</h1>`);
    }
  }
  return c.text(defaultMessages.notFound, 404);
});
export default app;
