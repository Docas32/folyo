import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePortfolio,
  finishSiteDeletion,
  collectDeletedPortfolios,
} from './site-deletion-service';
import { site, user, now } from './fixtures.test-helper';
import type { SiteDeletion } from './site-deletion-repository';
const job: SiteDeletion = {
  siteId: site.id,
  userId: user.id,
  handle: site.handle,
  assetKeys: [`assets/${user.id}/old.png`],
  createdAt: now,
};
function fixtures() {
  const assetBucket = {
    list: vi
      .fn()
      .mockResolvedValue({
        objects: [{ key: job.assetKeys[0] }],
        truncated: false,
      }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const siteBucket = {
    list: vi
      .fn()
      .mockResolvedValue({
        objects: [
          { key: `sites/${site.id}/v1/index.html` },
          { key: `sites/${site.id}/v4/site.css` },
        ],
        truncated: false,
      }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const repo = {
    remove: vi.fn().mockResolvedValue(job),
    pending: vi.fn().mockResolvedValue([job]),
    liveAssetKeys: vi.fn().mockResolvedValue(new Set<string>()),
    hasSite: vi.fn().mockResolvedValue(false),
    complete: vi.fn().mockResolvedValue(undefined),
  };
  const kv = {
    get: vi
      .fn()
      .mockResolvedValue(JSON.stringify({ siteId: site.id, version: 4 })),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const bindings = {
    kv,
    assets: async () => assetBucket,
    sites: async () => siteBucket,
  };
  return { repo, kv, bindings, assetBucket, siteBucket };
}
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
describe('portfolio deletion lifecycle', () => {
  it('commits database removal before unpublishing and cleaning every object prefix', async () => {
    const f = fixtures();
    expect(await deletePortfolio(f.repo, f.bindings, user.id, site)).toEqual({
      ok: true,
      handle: site.handle,
    });
    expect(f.repo.remove).toHaveBeenCalledWith(site.id, user.id);
    expect(f.kv.delete).toHaveBeenCalledWith(`site:${site.handle}`);
    expect(f.kv.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.repo.remove.mock.invocationCallOrder[0]!,
    );
    expect(f.siteBucket.list).toHaveBeenCalledWith({
      prefix: `sites/${site.id}/`,
      limit: 1000,
    });
    expect(f.assetBucket.list).toHaveBeenCalledWith({
      prefix: `assets/${user.id}/`,
      limit: 1000,
    });
    expect(f.siteBucket.delete).toHaveBeenCalledWith([
      `sites/${site.id}/v1/index.html`,
      `sites/${site.id}/v4/site.css`,
    ]);
    expect(f.kv.delete.mock.invocationCallOrder[0]).toBeLessThan(
      f.siteBucket.delete.mock.invocationCallOrder[0]!,
    );
    expect(f.repo.complete).toHaveBeenCalledWith(site.id);
  });
  it('does not roll back the site when R2 fails and leaves a durable retry job', async () => {
    const f = fixtures();
    f.assetBucket.list.mockRejectedValue(new Error('R2 unavailable'));
    expect(await deletePortfolio(f.repo, f.bindings, user.id, site)).toEqual({
      ok: true,
      handle: site.handle,
    });
    expect(f.kv.delete).toHaveBeenCalledWith(`site:${site.handle}`);
    expect(f.repo.complete).not.toHaveBeenCalled();
    expect(f.siteBucket.delete).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Portfolio cleanup pending', {
      siteId: site.id,
      bucket: 'assets',
    });
    f.assetBucket.list.mockResolvedValue({
      objects: [{ key: job.assetKeys[0] }],
      truncated: false,
    });
    expect(await collectDeletedPortfolios(f.repo, f.bindings)).toBe(1);
    expect(f.repo.complete).toHaveBeenCalledWith(site.id);
  });
  it('keeps retry state and returns an error when critical KV deletion fails', async () => {
    const f = fixtures();
    f.kv.delete.mockRejectedValue(new Error('KV down'));
    await expect(
      deletePortfolio(f.repo, f.bindings, user.id, site),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.repo.remove).toHaveBeenCalled();
    expect(f.repo.complete).not.toHaveBeenCalled();
    f.kv.delete.mockResolvedValue(undefined);
    expect(await collectDeletedPortfolios(f.repo, f.bindings)).toBe(1);
  });
  it.each([undefined, { ...site, userId: 'another-user' }])(
    'returns 404 without effects for a missing/unowned site',
    async (current) => {
      const f = fixtures();
      await expect(
        deletePortfolio(f.repo, f.bindings, user.id, current),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.repo.remove).not.toHaveBeenCalled();
      expect(f.kv.delete).not.toHaveBeenCalled();
    },
  );
  it('does not delete routing owned by a new portfolio that reused the old handle', async () => {
    const f = fixtures();
    f.kv.get.mockResolvedValue(
      JSON.stringify({ siteId: 'new-site', version: 1 }),
    );
    expect(await finishSiteDeletion(f.repo, f.bindings, job)).toBe(true);
    expect(f.kv.delete).not.toHaveBeenCalled();
    expect(f.siteBucket.delete).toHaveBeenCalled();
  });
  it('protects new uploads while cleaning a deleted portfolio after recreation', async () => {
    const f = fixtures();
    f.repo.hasSite.mockResolvedValue(true);
    const fresh = `assets/${user.id}/fresh.png`,
      orphan = `assets/${user.id}/old-orphan.png`;
    f.repo.liveAssetKeys.mockResolvedValue(new Set([fresh]));
    f.assetBucket.list.mockResolvedValue({
      objects: [
        { key: job.assetKeys[0] },
        { key: fresh },
        { key: orphan, uploaded: new Date(now.getTime() - 86400000) },
        {
          key: `assets/${user.id}/upload-in-flight.png`,
          uploaded: new Date(now.getTime() + 10000),
        },
      ],
      truncated: false,
    });
    expect(await finishSiteDeletion(f.repo, f.bindings, job)).toBe(true);
    expect(f.assetBucket.delete).toHaveBeenCalledWith([
      job.assetKeys[0],
      orphan,
    ]);
  });
  it('paginates both prefixes and rejects objects outside owned prefixes', async () => {
    const f = fixtures();
    f.assetBucket.list
      .mockResolvedValueOnce({
        objects: [{ key: job.assetKeys[0] }],
        truncated: true,
        cursor: 'next',
      })
      .mockResolvedValueOnce({ objects: [], truncated: false });
    expect(await finishSiteDeletion(f.repo, f.bindings, job)).toBe(true);
    expect(f.assetBucket.list).toHaveBeenLastCalledWith({
      prefix: `assets/${user.id}/`,
      limit: 1000,
      cursor: 'next',
    });
    f.assetBucket.list.mockResolvedValue({
      objects: [{ key: 'assets/another-user/image.png' }],
      truncated: false,
    });
    expect(await finishSiteDeletion(f.repo, f.bindings, job)).toBe(false);
  });
});
