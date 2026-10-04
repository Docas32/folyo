import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({ pageRepository: vi.fn() }));
import { accountContext } from './session';
import { pageRepository } from './runtime';
import { POST } from '../app/api/pages/route';
import { PATCH, DELETE } from '../app/api/pages/[pageId]/route';
import { PUT } from '../app/api/pages/reorder/route';
import { MAX_PAGES, slugify, type EditorPage } from '@folyo/core';
import type { PageRepository } from './page-repository';
import { AccountError } from './account-service';
import { mockRepository, user, site } from './fixtures.test-helper';
const first: EditorPage = {
  id: '40000000-0000-4000-8000-000000000004',
  siteId: site.id,
  title: 'Home',
  slug: 'home',
  position: 0,
};
let stored: EditorPage[] = [];
function memoryRepo() {
  return {
    list: vi.fn(async () => stored),
    find: vi.fn(async (id: string, siteId: string) =>
      stored.find((page) => page.id === id && page.siteId === siteId),
    ),
    create: vi.fn(async (siteId: string, title: string) => {
      if (stored.length >= MAX_PAGES) return undefined;
      const base = slugify(title);
      let slug = base;
      let suffix = 2;
      while (stored.some((page) => page.slug === slug))
        slug = `${base}-${suffix++}`;
      const page = {
        id: crypto.randomUUID(),
        siteId,
        title,
        slug,
        position: Math.max(-1, ...stored.map((item) => item.position)) + 1,
      };
      stored.push(page);
      return page;
    }),
    rename: vi.fn(async (siteId: string, id: string, title: string) => {
      const page = stored.find(
        (item) => item.id === id && item.siteId === siteId,
      );
      if (page) page.title = title;
      return page;
    }),
    remove: vi.fn(async (_siteId: string, id: string) => {
      if (stored.length === 1) return false;
      stored = stored.filter((page) => page.id !== id);
      return true;
    }),
    reorder: vi.fn(async (_siteId: string, ids: string[]) => {
      if (
        ids.length !== stored.length ||
        stored.some((page) => !ids.includes(page.id))
      )
        return false;
      stored = ids.map((id, position) => ({
        ...stored.find((page) => page.id === id)!,
        position,
      }));
      return true;
    }),
  } satisfies PageRepository;
}
let repo = memoryRepo();
const req = (method: string, input?: unknown) =>
  new Request('http://localhost:3000/api/pages', {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
const ctx = (id = first.id) => ({ params: Promise.resolve({ pageId: id }) });
beforeEach(() => {
  vi.resetAllMocks();
  stored = [{ ...first }];
  repo = memoryRepo();
  vi.mocked(pageRepository).mockReturnValue(repo);
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
});
describe('page management API', () => {
  it('creates up to five pages, generates unique suffixes and rejects the sixth', async () => {
    for (const suffix of ['', '-2', '-3', '-4']) {
      const response = await POST(req('POST', { title: ' Projetos ' }));
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        title: 'Projetos',
        slug: `projetos${suffix}`,
      });
    }
    expect((await POST(req('POST', { title: 'Sixth' }))).status).toBe(400);
    expect(stored).toHaveLength(5);
    expect(stored.map((page) => page.position)).toEqual([0, 1, 2, 3, 4]);
  });
  it('renames only the title, preserving slug', async () => {
    const response = await PATCH(req('PATCH', { title: 'Novo título' }), ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: 'Novo título',
      slug: 'home',
    });
    expect(
      (await PATCH(req('PATCH', { title: 'Changed', slug: 'changed' }), ctx()))
        .status,
    ).toBe(400);
  });
  it('rejects deletion of the sole page, but deletes when another exists', async () => {
    expect((await DELETE(req('DELETE'), ctx())).status).toBe(400);
    await POST(req('POST', { title: 'Second' }));
    expect((await DELETE(req('DELETE'), ctx())).status).toBe(200);
    expect(stored).toHaveLength(1);
  });
  it('accepts an exact permutation and rejects incomplete or duplicate lists', async () => {
    await POST(req('POST', { title: 'Second' }));
    const ids = stored.map((page) => page.id).reverse();
    expect((await PUT(req('PUT', { pageIds: ids }))).status).toBe(200);
    expect(stored.map((page) => page.id)).toEqual(ids);
    expect((await PUT(req('PUT', { pageIds: ids.slice(0, 1) }))).status).toBe(
      400,
    );
    expect(
      (await PUT(req('PUT', { pageIds: [first.id, first.id] }))).status,
    ).toBe(400);
    expect(
      (await PUT(req('PUT', { pageIds: [first.id, crypto.randomUUID()] })))
        .status,
    ).toBe(400);
  });
  it('conceals foreign or invalid page IDs before parsing the body', async () => {
    const foreign = crypto.randomUUID();
    expect(
      (await PATCH(req('PATCH', { title: '' }), ctx(foreign))).status,
    ).toBe(404);
    expect((await DELETE(req('DELETE'), ctx(foreign))).status).toBe(404);
    expect((await DELETE(req('DELETE'), ctx('bad'))).status).toBe(404);
    expect(repo.rename).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it('requires auth and protects ownership and origin', async () => {
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await POST(req('POST', { title: 'New' }))).status).toBe(401);
    vi.mocked(accountContext).mockResolvedValue({
      user,
      site: { ...site, userId: crypto.randomUUID() },
      repo: mockRepository(),
    });
    expect((await POST(req('POST', { title: 'New' }))).status).toBe(403);
    const request = req('POST', { title: 'New' });
    request.headers.set('origin', 'https://evil.example');
    expect((await POST(request)).status).toBe(403);
  });
  it.each([
    { title: '' },
    { title: ' '.repeat(5) },
    { title: 'x'.repeat(121) },
    { title: 'New', siteId: 'other' },
  ])('validates title payloads', async (input) => {
    expect((await POST(req('POST', input))).status).toBe(400);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
