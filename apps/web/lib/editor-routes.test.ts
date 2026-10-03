import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({ editorRepository: vi.fn() }));
import { accountContext } from './session';
import { editorRepository } from './runtime';
import { GET } from '../app/api/editor/route';
import { PUT } from '../app/api/pages/[pageId]/blocks/route';
import { AccountError } from './account-service';
import { loadEditor, type EditorRepository } from './editor-service';
import { createDefaultBlock, type EditorBlock } from '@folyo/core';
import { mockRepository, user, site } from './fixtures.test-helper';
const page = {
  id: '40000000-0000-4000-8000-000000000004',
  siteId: site.id,
  title: 'Início',
  slug: 'inicio',
  position: 0,
};
const block: EditorBlock = {
  id: '30000000-0000-4000-8000-000000000003',
  position: 0,
  type: 'hero',
  content: createDefaultBlock('hero', 'pt-BR'),
};
const savedAt = '2026-10-03T12:00:00.000Z';
function mockEditorRepo() {
  return {
    bootstrapAndRead: vi
      .fn<EditorRepository['bootstrapAndRead']>()
      .mockResolvedValue({ pages: [page], blocks: [block] }),
    findPage: vi.fn<EditorRepository['findPage']>().mockResolvedValue(page),
    replaceBlocks: vi
      .fn<EditorRepository['replaceBlocks']>()
      .mockResolvedValue(savedAt),
  } satisfies EditorRepository;
}
let repo = mockEditorRepo();
const req = (body: unknown = { blocks: [block] }) =>
  new Request(`http://localhost:3000/api/pages/${page.id}/blocks`, {
    method: 'PUT',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
const context = (pageId = page.id) => ({ params: Promise.resolve({ pageId }) });
beforeEach(() => {
  vi.resetAllMocks();
  repo = mockEditorRepo();
  vi.mocked(editorRepository).mockReturnValue(repo);
  vi.mocked(accountContext).mockResolvedValue({
    repo: mockRepository(),
    user,
    site,
  });
});
describe('editor API authorization and validation', () => {
  it('GET bootstraps and returns only the owner document', async () => {
    const response = await GET(new Request('http://localhost:3000/api/editor'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      site: {
        id: site.id,
        handle: site.handle,
        title: site.title,
        status: site.status,
      },
      pages: [page],
      blocks: [block],
    });
    expect(repo.bootstrapAndRead).toHaveBeenCalledWith(site.id, 'pt-BR');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('PUT replaces the full ordered list and returns a server timestamp', async () => {
    const response = await PUT(req(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, savedAt });
    expect(repo.findPage).toHaveBeenCalledWith(page.id, site.id);
    expect(repo.replaceBlocks).toHaveBeenCalledWith(site.id, page.id, [block]);
  });
  it('supports deleting all blocks', async () => {
    expect((await PUT(req({ blocks: [] }), context())).status).toBe(200);
    expect(repo.replaceBlocks).toHaveBeenCalledWith(site.id, page.id, []);
  });
  it('returns 400 with a field path for invalid content', async () => {
    const response = await PUT(
      req({
        blocks: [{ ...block, type: 'image', content: { url: 'bad', alt: '' } }],
      }),
      context(),
    );
    expect(response.status).toBe(400);
    const data = (await response.json()) as {
      error: string;
      issues: { path: (string | number)[] }[];
    };
    expect(data.error).toBe('invalid');
    expect(data.issues.map((issue) => issue.path)).toContainEqual([
      'blocks',
      0,
      'content',
      'url',
    ]);
    expect(repo.replaceBlocks).not.toHaveBeenCalled();
  });
  it.each([
    { blocks: [{ ...block, position: 3 }] },
    { blocks: [block, { ...block, position: 1 }] },
    { blocks: [{ ...block, userId: 'other' }] },
    { blocks: [block], siteId: 'other' },
    {
      blocks: Array.from({ length: 101 }, (_, position) => ({
        ...block,
        position,
      })),
    },
  ])('rejects invalid list envelopes and identity fields', async (value) => {
    expect((await PUT(req(value), context())).status).toBe(400);
    expect(repo.replaceBlocks).not.toHaveBeenCalled();
  });
  it('returns 403 for a mismatched site owner before touching the database', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      repo: mockRepository(),
      user,
      site: { ...site, userId: 'other' },
    });
    expect((await PUT(req(), context())).status).toBe(403);
    expect(
      (await GET(new Request('http://localhost:3000/api/editor'))).status,
    ).toBe(403);
    expect(repo.bootstrapAndRead).not.toHaveBeenCalled();
    expect(repo.replaceBlocks).not.toHaveBeenCalled();
  });
  it('returns 404 for a foreign/nonexistent page without exposing validation or contents', async () => {
    repo.findPage.mockResolvedValue(undefined);
    expect((await PUT(req({ blocks: 'invalid' }), context())).status).toBe(404);
    expect(repo.replaceBlocks).not.toHaveBeenCalled();
  });
  it('returns 404 for malformed UUIDs', async () => {
    expect((await PUT(req(), context('bad-id'))).status).toBe(404);
    expect(repo.findPage).not.toHaveBeenCalled();
  });
  it('requires a session and previously accepted terms', async () => {
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await PUT(req(), context())).status).toBe(401);
    expect(
      (await GET(new Request('http://localhost:3000/api/editor'))).status,
    ).toBe(401);
    vi.mocked(accountContext).mockResolvedValue({
      repo: mockRepository(),
      user: { ...user, termsAcceptedAt: null },
      site,
    });
    expect((await PUT(req(), context())).status).toBe(403);
  });
  it('requires a site and a same-origin request', async () => {
    const request = req();
    request.headers.set('origin', 'https://evil.example');
    expect((await PUT(request, context())).status).toBe(403);
    vi.mocked(accountContext).mockResolvedValue({
      repo: mockRepository(),
      user,
      site: undefined,
    });
    expect(
      (await GET(new Request('http://localhost:3000/api/editor'))).status,
    ).toBe(409);
  });
  it('returns a generic error on DB failure and does not acknowledge a save', async () => {
    repo.replaceBlocks.mockRejectedValue(
      new Error('private connection details'),
    );
    const response = await PUT(req(), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
  it('does not report corrupted stored data as a client validation failure', async () => {
    repo.bootstrapAndRead.mockResolvedValue({
      pages: [page],
      blocks: [{ ...block, content: { name: 42 } }],
    });
    const response = await GET(new Request('http://localhost:3000/api/editor'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
  it('uses the same bootstrap entrypoint for SSR and the API', async () => {
    expect((await loadEditor(repo, user.id, site, 'pt-BR')).blocks).toEqual([
      block,
    ]);
    await GET(new Request('http://localhost:3000/api/editor'));
    expect(repo.bootstrapAndRead).toHaveBeenCalledTimes(2);
  });
});
