import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({
  siteDeletionRepository: vi.fn(),
  siteDeletionBindings: vi.fn(),
}));
import { accountContext } from './session';
import { siteDeletionRepository, siteDeletionBindings } from './runtime';
import { DELETE } from '../app/api/site/route';
import { site, user, now, mockRepository } from './fixtures.test-helper';
import { AccountError } from './account-service';
const repo = {
  remove: vi.fn(),
  pending: vi.fn(),
  liveAssetKeys: vi.fn(),
  hasSite: vi.fn(),
  complete: vi.fn(),
};
const kv = { get: vi.fn(), delete: vi.fn() };
const assets = { list: vi.fn(), delete: vi.fn() },
  sites = { list: vi.fn(), delete: vi.fn() };
function request(data?: unknown) {
  return new Request('http://localhost:3000/api/site', {
    method: 'DELETE',
    headers: {
      origin: 'http://localhost:3000',
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
  vi.mocked(siteDeletionRepository).mockReturnValue(repo);
  vi.mocked(siteDeletionBindings).mockResolvedValue({
    kv,
    assets: async () => assets,
    sites: async () => sites,
  });
  repo.remove.mockResolvedValue({
    siteId: site.id,
    userId: user.id,
    handle: site.handle,
    assetKeys: [],
    createdAt: now,
  });
  repo.liveAssetKeys.mockResolvedValue(new Set());
  repo.hasSite.mockResolvedValue(false);
  kv.get.mockResolvedValue(null);
  for (const bucket of [assets, sites])
    bucket.list.mockResolvedValue({ objects: [], truncated: false });
});
describe('DELETE /api/site', () => {
  it('deletes only the logged-in portfolio, preserves the account/session and frees its handle', async () => {
    const response = await DELETE(request({ handle: site.handle }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, handle: site.handle });
    expect(repo.remove).toHaveBeenCalledWith(site.id, user.id);
    expect(kv.delete).toHaveBeenCalledWith(`site:${site.handle}`);
    const context = await accountContext();
    expect(context.repo.deleteUser).not.toHaveBeenCalled();
  });
  it('also supports an authenticated bodyless DELETE', async () =>
    expect((await DELETE(request())).status).toBe(200));
  it.each([undefined, { ...site, userId: 'foreign' }])(
    'returns 404 for missing/foreign ownership',
    async (current) => {
      vi.mocked(accountContext).mockResolvedValue({
        user,
        site: current,
        repo: mockRepository(),
      });
      expect((await DELETE(request())).status).toBe(404);
      expect(repo.remove).not.toHaveBeenCalled();
      expect(kv.delete).not.toHaveBeenCalled();
    },
  );
  it('returns 404 after prior removal and never turns an idempotent retry into 500', async () => {
    repo.remove.mockRejectedValue(new AccountError('notFound', 404));
    expect((await DELETE(request())).status).toBe(404);
    expect(kv.delete).not.toHaveBeenCalled();
  });
  it('rejects a wrong confirmation, unauthenticated access and foreign origin', async () => {
    expect((await DELETE(request({ handle: 'different' }))).status).toBe(400);
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await DELETE(request())).status).toBe(401);
    const cross = request();
    cross.headers.set('origin', 'https://evil.example');
    expect((await DELETE(cross)).status).toBe(403);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
