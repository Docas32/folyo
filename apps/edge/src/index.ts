import { Hono } from 'hono';
import {
  defaultMessages,
  environmentSchema,
  availableHandleSchema,
} from '@folyo/core';
export interface Bindings {
  ROOT_DOMAIN: string;
  ENVIRONMENT: string;
  SITE_KV: KVNamespace;
  WEB: Pick<Fetcher, 'fetch'>;
  ASSETS_BUCKET: R2Bucket;
  SITES_BUCKET: R2Bucket;
}
const app = new Hono<{
  Bindings: Bindings;
}>();
app.all('*', async (c) => {
  const parsed = environmentSchema.safeParse(c.env);
  if (!parsed.success) return c.text(defaultMessages.invalidEnvironment, 500);
  const { ROOT_DOMAIN, ENVIRONMENT } = parsed.data;
  // Host is used explicitly so local curl requests can exercise host dispatch.
  const authority = (c.req.header('host') ?? new URL(c.req.url).host)
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(authority))
    return c.text(defaultMessages.notFound, 404);
  const host = authority.split(':')[0] ?? '';
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
  if (
    host === `app.${ROOT_DOMAIN}` ||
    (ENVIRONMENT === 'dev' && (host === 'localhost' || host === '127.0.0.1'))
  ) {
    if (url.pathname === '/__dev/r2' || url.pathname === '/__dev/r2-health') {
      if (ENVIRONMENT !== 'dev' || c.req.method !== 'GET') {
        return c.text(defaultMessages.notFound, 404);
      }
      const listed = await c.env.SITES_BUCKET.list({
        limit: 100,
      });
      return c.json({
        ok: true,
        objects: listed.objects.map((object) => ({
          key: object.key,
          size: object.size,
        })),
        truncated: listed.truncated,
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
      const clientAcceptsGzip =
        c.req.header('accept-encoding')?.includes('gzip') ?? false;
      if (
        clientAcceptsGzip ||
        response.headers.get('content-encoding') !== 'gzip'
      )
        return response;
      // Fallback: undo an unwanted gzip so plain clients (curl, fetch) get readable HTML.
      if (!response.body) return response;
      const headers = new Headers(response.headers);
      headers.delete('content-encoding');
      headers.delete('content-length');
      return new Response(
        response.body.pipeThrough(new DecompressionStream('gzip')),
        {
          status: response.status,
          statusText: response.statusText,
          headers,
        },
      );
    }
    return c.env.WEB.fetch(c.req.raw);
  }
  const suffix = `.${ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const handle = availableHandleSchema.safeParse(
      host.slice(0, -suffix.length),
    );
    if (handle.success) {
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD')
        return c.text('Method not allowed', 405, { Allow: 'GET, HEAD' });
      const notFound = () =>
        c.text(
          c.req.header('accept-language')?.toLowerCase().startsWith('en')
            ? 'Site not found'
            : 'Site não encontrado',
          404,
          { 'Cache-Control': 'no-store' },
        );
      const value = await c.env.SITE_KV.get(`site:${handle.data}`);
      let pointer: { siteId: string; version: number };
      try {
        const raw = JSON.parse(value ?? 'null');
        if (
          !raw ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            raw.siteId,
          ) ||
          !Number.isSafeInteger(raw.version) ||
          raw.version < 1
        )
          return notFound();
        pointer = raw;
      } catch {
        return notFound();
      }
      const path = url.pathname;
      if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(path))
        return c.redirect(`${path.slice(0, -1)}${url.search}`, 301);
      const css = path === '/site.css';
      const versionParam = url.searchParams.get('v');
      const cssVersion =
        css && versionParam ? Number(versionParam) : pointer.version;
      if (
        css &&
        (!Number.isSafeInteger(cssVersion) ||
          cssVersion < 1 ||
          cssVersion > pointer.version)
      )
        return notFound();
      if (!css && path !== '/' && !/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path))
        return notFound();
      const prefix = `sites/${pointer.siteId}/v${css ? cssVersion : pointer.version}/`;
      const objectKey = `${prefix}${css ? 'site.css' : path === '/' ? 'index.html' : `${path.slice(1)}/index.html`}`;
      const object = await c.env.SITES_BUCKET.get(objectKey);
      if (!object) return notFound();
      return new Response(c.req.method === 'HEAD' ? null : object.body, {
        headers: {
          'Content-Type': css
            ? 'text/css; charset=utf-8'
            : 'text/html; charset=utf-8',
          'Cache-Control':
            css && versionParam
              ? 'public,max-age=31536000,immutable'
              : 'public,max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  }
  return c.text(defaultMessages.notFound, 404);
});
export default app;
