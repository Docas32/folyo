import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../session', () => ({ accountContext: vi.fn() }));
vi.mock('../runtime', () => ({
  publishRepository: vi.fn(),
  publicationBindings: vi.fn(),
  publishEnvironment: vi.fn(),
}));
import { accountContext } from '../session';
import {
  publicationBindings,
  publishEnvironment,
  publishRepository,
} from '../runtime';
import { mockRepository, site, user } from '../fixtures.test-helper';
import { POST as publish } from '../../app/api/site/publish/route';
import { POST as unpublish } from '../../app/api/site/unpublish/route';
import { AccountError } from '../account-service';
import { readPublishEnvironment } from './environment';
import type { PublishRepository } from './repository';
const homeId = '30000000-0000-4000-8000-000000000003';
const aboutId = '40000000-0000-4000-8000-000000000004';
let current = { ...site, title: 'Maria' };
let snapshotPages = [
  { id: homeId, siteId: site.id, title: 'Home', slug: 'home', position: 0 },
  { id: aboutId, siteId: site.id, title: 'About', slug: 'about', position: 1 },
];
let objects = new Map<string, string>();
let pointers = new Map<string, string>();
const repo = {
  acquire: vi.fn<PublishRepository['acquire']>(),
  protect: vi.fn<PublishRepository['protect']>(),
  record: vi.fn<PublishRepository['record']>(),
  activate: vi.fn<PublishRepository['activate']>(),
  draft: vi.fn<PublishRepository['draft']>(),
  release: vi.fn<PublishRepository['release']>(),
  publishedAt: vi.fn<PublishRepository['publishedAt']>(),
};
const put = vi.fn<R2Bucket['put']>();
const kvPut = vi.fn<KVNamespace['put']>();
const kvDelete = vi.fn<KVNamespace['delete']>();
const kvGet = vi.fn<(key: string) => Promise<string | null>>();
const req = (action = 'publish', origin = 'http://localhost:3000') =>
  new Request(`http://localhost:3000/api/site/${action}`, {
    method: 'POST',
    headers: { origin },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(publishEnvironment).mockImplementation(() =>
    readPublishEnvironment({
      ROOT_DOMAIN: 'lvh.me',
      ENVIRONMENT: 'dev',
      SITE_EDGE_PORT: '8787',
      APP_PUBLIC_URL: 'http://app.lvh.me:3000',
    }),
  );
  current = { ...site, title: 'Maria' };
  objects = new Map();
  pointers = new Map();
  snapshotPages = [
    { id: homeId, siteId: site.id, title: 'Home', slug: 'home', position: 0 },
    {
      id: aboutId,
      siteId: site.id,
      title: 'About',
      slug: 'about',
      position: 1,
    },
  ];
  repo.acquire.mockImplementation(async () => ({
    site: current,
    locale: user.locale,
    pages: snapshotPages,
    blocks: [
      {
        id: 'block',
        pageId: homeId,
        type: 'image',
        position: 0,
        content: {
          url: `/api/assets/assets/${user.id}/50000000-0000-4000-8000-000000000005.webp`,
          alt: 'Photo',
        },
      },
    ],
  }));
  repo.activate.mockImplementation(async (_, version) => {
    current = { ...current, publishedVersion: version, status: 'published' };
  });
  repo.draft.mockImplementation(async () => {
    current = { ...current, status: 'draft' };
  });
  put.mockImplementation(async (key, value) => {
    objects.set(key, String(value));
    return {} as R2Object;
  });
  kvPut.mockImplementation(async (key, value) => {
    pointers.set(key, String(value));
  });
  kvGet.mockImplementation(async (key: string) => pointers.get(key) ?? null);
  kvDelete.mockImplementation(async (key) => {
    pointers.delete(key);
  });
  vi.mocked(accountContext).mockResolvedValue({
    repo: mockRepository(),
    user,
    site: current,
  });
  vi.mocked(publishRepository).mockReturnValue(repo);
  vi.mocked(publicationBindings).mockResolvedValue({
    sites: { put } as unknown as R2Bucket,
    kv: { get: kvGet, put: kvPut, delete: kvDelete } as unknown as KVNamespace,
  });
});
describe('publication API', () => {
  it('writes every page and CSS before publication + KV + status, and increments versions', async () => {
    const response = await publish(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'http://maria.lvh.me:8787',
      version: 1,
    });
    expect([...objects.keys()]).toEqual([
      `sites/${site.id}/v1/index.html`,
      `sites/${site.id}/v1/about/index.html`,
      `sites/${site.id}/v1/site.css`,
      `sites/${site.id}/v1/robots.txt`,
      `sites/${site.id}/v1/sitemap.xml`,
    ]);
    expect(repo.record).toHaveBeenCalledWith(
      site.id,
      1,
      `sites/${site.id}/v1/`,
      [`assets/${user.id}/50000000-0000-4000-8000-000000000005.webp`],
      expect.any(Date),
    );
    expect(repo.protect.mock.invocationCallOrder[0]).toBeLessThan(
      put.mock.invocationCallOrder[0]!,
    );
    expect(put.mock.invocationCallOrder.at(-1)).toBeLessThan(
      repo.record.mock.invocationCallOrder[0]!,
    );
    expect(repo.record.mock.invocationCallOrder[0]).toBeLessThan(
      kvPut.mock.invocationCallOrder[0]!,
    );
    expect(kvPut.mock.invocationCallOrder[0]).toBeLessThan(
      repo.activate.mock.invocationCallOrder[0]!,
    );
    const firstHtml = objects.get(`sites/${site.id}/v1/index.html`);
    current = { ...current, title: 'Updated draft' };
    expect(objects.get(`sites/${site.id}/v1/index.html`)).toBe(firstHtml);
    expect(await (await publish(req())).json()).toMatchObject({ version: 2 });
    expect(objects.get(`sites/${site.id}/v2/index.html`)).toContain(
      '<title>Updated draft</title>',
    );
    expect(objects.get(`sites/${site.id}/v1/index.html`)).toBe(firstHtml);
    expect(pointers.get('site:maria')).toBe(
      JSON.stringify({ siteId: site.id, version: 2 }),
    );
    expect(repo.release).toHaveBeenCalledTimes(2);
  });
  it('publishes only absolute app asset URLs for hero, image, every gallery item and metadata', async () => {
    const key = `/api/assets/assets/${user.id}/50000000-0000-4000-8000-000000000005.webp`;
    const base = 'https://images-app.example.com';
    vi.mocked(publishEnvironment).mockImplementation(() =>
      readPublishEnvironment({
        ROOT_DOMAIN: 'lvh.me',
        ENVIRONMENT: 'dev',
        SITE_EDGE_PORT: '8787',
        APP_PUBLIC_URL: base,
      }),
    );
    repo.acquire.mockImplementation(async () => ({
      site: current,
      locale: user.locale,
      pages: snapshotPages,
      blocks: [
        {
          id: 'hero',
          pageId: homeId,
          type: 'hero',
          position: 0,
          content: { name: 'Maria', title: 'Designer', avatarUrl: key },
        },
        {
          id: 'image',
          pageId: homeId,
          type: 'image',
          position: 1,
          content: { url: key, alt: 'Image' },
        },
        {
          id: 'gallery',
          pageId: aboutId,
          type: 'gallery',
          position: 0,
          content: {
            items: [
              { url: key, alt: 'One' },
              { url: key, alt: 'Two' },
            ],
          },
        },
      ],
    }));
    expect((await publish(req())).status).toBe(200);
    const htmlPages = [...objects.entries()]
      .filter(([key]) => key.endsWith('.html'))
      .map(([, html]) => html);
    expect(htmlPages).toHaveLength(2);
    const srcs = htmlPages.flatMap((html) =>
      [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(
        (match) => match[1]!,
      ),
    );
    expect(srcs).toHaveLength(4);
    for (const src of srcs) {
      expect(src.startsWith(base + '/api/assets/')).toBe(true);
      expect(new URL(src).origin).toBe(base);
    }
    for (const html of htmlPages) {
      expect(html).toContain(`property="og:image" content="${base}${key}"`);
      expect(html).toContain(`name="twitter:image" content="${base}${key}"`);
      expect(html).not.toContain('src="/api/assets/');
    }
  });
  it.each([undefined, '', '   '])(
    'returns a clear 400 without storage or DB writes when APP_PUBLIC_URL is %s',
    async (APP_PUBLIC_URL) => {
      vi.mocked(publishEnvironment).mockImplementation(() =>
        readPublishEnvironment({
          ROOT_DOMAIN: 'lvh.me',
          ENVIRONMENT: 'dev',
          APP_PUBLIC_URL,
        }),
      );
      const response = await publish(req());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'publishAppUrlRequired',
        message: 'APP_PUBLIC_URL não configurada',
      });
      expect(repo.acquire).not.toHaveBeenCalled();
      expect(publicationBindings).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
      expect(kvPut).not.toHaveBeenCalled();
    },
  );
  it('localizes missing origin errors and rejects invalid origins explicitly', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      repo: mockRepository(),
      site: current,
      user: { ...user, locale: 'en' },
    });
    vi.mocked(publishEnvironment).mockImplementation(() =>
      readPublishEnvironment({ APP_PUBLIC_URL: undefined }),
    );
    expect(await (await publish(req())).json()).toMatchObject({
      message: 'APP_PUBLIC_URL is not configured',
    });
    vi.mocked(publishEnvironment).mockImplementation(() =>
      readPublishEnvironment({ APP_PUBLIC_URL: 'javascript:alert(1)' }),
    );
    const response = await publish(req());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'publishAppUrlInvalid',
    });
  });
  it.each(['title', 'pages', 'handle'])(
    'rejects missing/invalid %s before writing storage',
    async (field) => {
      if (field === 'title') current.title = '   ';
      if (field === 'pages') snapshotPages = [];
      if (field === 'handle') current.handle = 'app';
      const response = await publish(req());
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error:
          field === 'title'
            ? 'publishTitleRequired'
            : field === 'pages'
              ? 'publishPagesRequired'
              : 'publishHandleInvalid',
      });
      expect(put).not.toHaveBeenCalled();
      expect(kvPut).not.toHaveBeenCalled();
    },
  );
  it('rejects foreign ownership and cross-origin requests without touching publication storage', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      repo: mockRepository(),
      user,
      site: { ...current, userId: 'foreign' },
    });
    expect((await publish(req())).status).toBe(403);
    expect((await unpublish(req('unpublish'))).status).toBe(403);
    expect((await publish(req('publish', 'https://evil.example'))).status).toBe(
      403,
    );
    expect(repo.acquire).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
  it('leaves the active pointer and status unchanged when any R2 write fails', async () => {
    pointers.set('site:maria', JSON.stringify({ siteId: site.id, version: 7 }));
    current = { ...current, status: 'published', publishedVersion: 7 };
    put.mockRejectedValueOnce(new Error('R2 unavailable'));
    expect((await publish(req())).status).toBe(503);
    expect(pointers.get('site:maria')).toBe(
      JSON.stringify({ siteId: site.id, version: 7 }),
    );
    expect(repo.record).not.toHaveBeenCalled();
    expect(repo.activate).not.toHaveBeenCalled();
    expect(repo.release).toHaveBeenCalledOnce();
  });
  it('does not activate the DB version if the KV write fails', async () => {
    kvPut.mockRejectedValueOnce(new Error('KV unavailable'));
    expect((await publish(req())).status).toBe(503);
    expect(kvPut).toHaveBeenCalledOnce();
    expect(repo.activate).not.toHaveBeenCalled();
    expect(current.status).toBe('draft');
  });
  it('restores the previous pointer when DB activation fails', async () => {
    const old = JSON.stringify({ siteId: site.id, version: 2 });
    pointers.set('site:maria', old);
    current = { ...current, publishedVersion: 2, status: 'published' };
    repo.activate.mockRejectedValueOnce(new Error('DB unavailable'));
    expect((await publish(req())).status).toBe(503);
    expect(repo.activate).toHaveBeenCalledOnce();
    expect(kvPut).toHaveBeenCalledTimes(2);
    expect(pointers.get('site:maria')).toBe(old);
    expect(repo.release).toHaveBeenCalledOnce();
  });
  it('rejects simultaneous operations before writing the same version prefix', async () => {
    repo.acquire.mockRejectedValueOnce(
      new AccountError('publicationBusy', 409),
    );
    expect((await publish(req())).status).toBe(409);
    expect(put).not.toHaveBeenCalled();
    expect(kvPut).not.toHaveBeenCalled();
    expect(repo.release).not.toHaveBeenCalled();
  });
  it('retains serialization and asset protection when compensation fails', async () => {
    pointers.set('site:maria', JSON.stringify({ siteId: site.id, version: 2 }));
    current = { ...current, publishedVersion: 2, status: 'published' };
    repo.activate.mockRejectedValueOnce(new Error('DB unavailable'));
    kvPut.mockImplementationOnce(async (key, value) => {
      pointers.set(key, String(value));
    });
    kvPut.mockRejectedValueOnce(new Error('Rollback unavailable'));
    expect((await publish(req())).status).toBe(503);
    expect(repo.protect).toHaveBeenCalled();
    expect(repo.release).not.toHaveBeenCalled();
  });
  it('restores routing when unpublish cannot mark draft', async () => {
    const old = JSON.stringify({ siteId: site.id, version: 2 });
    pointers.set('site:maria', old);
    current = { ...current, publishedVersion: 2, status: 'published' };
    repo.draft.mockRejectedValueOnce(new Error('DB unavailable'));
    expect((await unpublish(req('unpublish'))).status).toBe(503);
    expect(pointers.get('site:maria')).toBe(old);
    expect(repo.release).toHaveBeenCalledOnce();
  });
  it('unpublishes idempotently and retains publication history/objects', async () => {
    await publish(req());
    const previousObjects = [...objects.keys()];
    expect(await (await unpublish(req('unpublish'))).json()).toEqual({
      ok: true,
    });
    expect(pointers.has('site:maria')).toBe(false);
    expect(current.status).toBe('draft');
    expect([...objects.keys()]).toEqual(previousObjects);
    expect(await (await unpublish(req('unpublish'))).json()).toEqual({
      ok: true,
    });
  });
});

it('protects custom favicon assets and writes SEO files for the same publication timestamp', async () => {
  current = {
    ...current,
    faviconKey: `assets/${user.id}/50000000-0000-4000-8000-000000000006.svg`,
  };
  expect((await publish(req())).status).toBe(200);
  expect(repo.protect).toHaveBeenCalledWith(
    site.id,
    expect.any(String),
    expect.arrayContaining([current.faviconKey]),
  );
  expect(objects.get(`sites/${site.id}/v1/index.html`)).toContain(
    `href="http://app.lvh.me:3000/api/assets/${current.faviconKey}"`,
  );
  const sitemap = objects.get(`sites/${site.id}/v1/sitemap.xml`)!;
  const publishedAt = repo.record.mock.calls[0]![4];
  expect(sitemap).toContain(publishedAt.toISOString());
  expect(sitemap).toContain('http://maria.lvh.me:8787/about');
  expect(objects.get(`sites/${site.id}/v1/robots.txt`)).toContain(
    'Sitemap: http://maria.lvh.me:8787/sitemap.xml',
  );
});
