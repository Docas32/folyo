import { describe, expect, it, vi } from 'vitest';
import {
  checkHandle,
  clearPrefix,
  createSite,
  deleteAccount,
  HANDLE_COOLDOWN_MS,
  nextHandleChange,
  patchSite,
  postLoginPath,
  type Bucket,
} from './account-service';
import { mockRepository, now, site, user } from './fixtures.test-helper';

function bucket() {
  return {
    list: vi
      .fn<Bucket['list']>()
      .mockResolvedValue({ objects: [], truncated: false }),
    delete: vi.fn<Bucket['delete']>().mockResolvedValue(undefined),
  };
}
describe('account rules', () => {
  it('forces terms before onboarding, then dashboard', () => {
    expect(postLoginPath({ ...user, termsAcceptedAt: null }, site)).toBe(
      '/accept-terms',
    );
    expect(postLoginPath(user, undefined)).toBe('/onboarding');
    expect(postLoginPath(user, site)).toBe('/dashboard');
  });
  it('normalizes handle before database checks', async () => {
    const repo = mockRepository();
    expect(await checkHandle(repo, '  MARIA  ')).toEqual({ available: true });
    expect(repo.isTaken).toHaveBeenCalledWith('maria', undefined);
  });
  it('rejects invalid and reserved handles without uniqueness query', async () => {
    const repo = mockRepository();
    expect(await checkHandle(repo, '-abc')).toEqual({
      available: false,
      reason: 'invalid',
    });
    expect(await checkHandle(repo, ' APP ')).toEqual({
      available: false,
      reason: 'reserved',
    });
    expect(repo.isTaken).not.toHaveBeenCalled();
  });
  it('checks additional database reservations', async () => {
    const repo = mockRepository();
    repo.isReserved.mockResolvedValue(true);
    expect(await checkHandle(repo, 'custom')).toEqual({
      available: false,
      reason: 'reserved',
    });
  });
  it('detects existing sites', async () => {
    const repo = mockRepository();
    repo.isTaken.mockResolvedValue(true);
    expect(await checkHandle(repo, 'maria')).toEqual({
      available: false,
      reason: 'taken',
    });
  });
  it('creates a site with the session owner and normalized handle', async () => {
    const repo = mockRepository();
    await createSite(repo, user.id, ' Maria ');
    expect(repo.createSite).toHaveBeenCalledWith(user.id, 'maria');
  });
  it('maps unique violations including wrapped driver errors to 409', async () => {
    const repo = mockRepository();
    repo.createSite.mockRejectedValue({ cause: { code: '23505' } });
    await expect(createSite(repo, user.id, 'maria')).rejects.toMatchObject({
      code: 'taken',
      status: 409,
    });
  });
  it('does not create a second site for the user', async () => {
    const repo = mockRepository();
    repo.findSite.mockResolvedValue(site);
    await expect(createSite(repo, user.id, 'other')).rejects.toMatchObject({
      code: 'conflict',
      status: 409,
    });
    expect(repo.createSite).not.toHaveBeenCalled();
  });
  it('allows the first change and the exact 7-day boundary', () => {
    expect(nextHandleChange(null, now)).toBeNull();
    expect(
      nextHandleChange(new Date(now.getTime() - HANDLE_COOLDOWN_MS), now),
    ).toBeNull();
    expect(
      nextHandleChange(
        new Date(now.getTime() - HANDLE_COOLDOWN_MS + 1),
        now,
      )?.toISOString(),
    ).toBe('2026-10-03T12:00:00.001Z');
  });
  it('rejects a handle change inside the cooldown with the release date', async () => {
    const repo = mockRepository();
    await expect(
      patchSite(
        repo,
        user.id,
        { ...site, handleChangedAt: now },
        { handle: 'other' },
        now,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'cooldown',
      nextAllowedAt: '2026-10-10T12:00:00.000Z',
    });
    expect(repo.updateSite).not.toHaveBeenCalled();
  });
  it('allows metadata changes during cooldown', async () => {
    const repo = mockRepository();
    await patchSite(
      repo,
      user.id,
      { ...site, handleChangedAt: now },
      { title: 'Portfolio' },
      now,
    );
    expect(repo.updateSite).toHaveBeenCalledWith(
      user.id,
      site.id,
      { title: 'Portfolio' },
      now,
    );
  });
  it('rejects another owner', async () => {
    await expect(
      patchSite(mockRepository(), 'other-user', site, { title: 'x' }, now),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('maps handle update uniqueness races', async () => {
    const repo = mockRepository();
    repo.updateSite.mockRejectedValue({ code: '23505' });
    await expect(
      patchSite(repo, user.id, site, { handle: 'new-name' }, now),
    ).rejects.toMatchObject({ code: 'taken', status: 409 });
  });
  it('reports a concurrent cooldown update after compare-and-set fails', async () => {
    const repo = mockRepository();
    repo.updateSite.mockResolvedValue(false);
    repo.findSite.mockResolvedValue({ ...site, handleChangedAt: now });
    await expect(
      patchSite(repo, user.id, site, { handle: 'new-name' }, now),
    ).rejects.toMatchObject({
      code: 'cooldown',
      nextAllowedAt: '2026-10-10T12:00:00.000Z',
    });
  });
});
describe('account deletion', () => {
  it('cleans both owned prefixes before deleting the database account', async () => {
    const repo = mockRepository();
    const assets = bucket();
    const sites = bucket();
    sites.list.mockResolvedValue({
      objects: [{ key: `sites/${site.id}/index.html` }],
      truncated: false,
    });
    assets.list.mockResolvedValue({
      objects: [{ key: `assets/${user.id}/photo.jpg` }],
      truncated: false,
    });
    await deleteAccount(repo, { assets, sites }, user.id, site, 'maria');
    expect(sites.list).toHaveBeenCalledWith({
      prefix: `sites/${site.id}/`,
      limit: 1000,
    });
    expect(assets.delete).toHaveBeenCalledWith([`assets/${user.id}/photo.jpg`]);
    expect(repo.deleteUser).toHaveBeenCalledWith(user.id);
    expect(repo.deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      assets.delete.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it('paginates and batches within the 1000-object deletion limit', async () => {
    const storage = bucket();
    storage.list
      .mockResolvedValueOnce({
        objects: Array.from({ length: 1001 }, (_, i) => ({
          key: `sites/id/${i}`,
        })),
        truncated: true,
        cursor: 'next',
      })
      .mockResolvedValueOnce({
        objects: [{ key: 'sites/id/last' }],
        truncated: false,
      });
    await clearPrefix(storage, 'sites/id/');
    expect(storage.list).toHaveBeenLastCalledWith({
      prefix: 'sites/id/',
      limit: 1000,
      cursor: 'next',
    });
    expect(storage.delete.mock.calls.map(([keys]) => keys.length)).toEqual([
      1000, 1, 1,
    ]);
  });
  it('keeps DB IDs for retry when R2 fails', async () => {
    const repo = mockRepository();
    const assets = bucket();
    const sites = bucket();
    sites.list.mockRejectedValue(new Error('R2 unavailable'));
    await expect(
      deleteAccount(repo, { assets, sites }, user.id, site, 'maria'),
    ).rejects.toThrow();
    expect(repo.deleteUser).not.toHaveBeenCalled();
  });
  it('supports empty buckets without delete calls', async () => {
    const repo = mockRepository();
    const assets = bucket();
    const sites = bucket();
    await deleteAccount(repo, { assets, sites }, user.id, site, 'maria');
    expect(assets.delete).not.toHaveBeenCalled();
    expect(sites.delete).not.toHaveBeenCalled();
    expect(repo.deleteUser).toHaveBeenCalledOnce();
  });
  it('rejects wrong confirmation and wrong owner before touching storage', async () => {
    const repo = mockRepository();
    const assets = bucket();
    const sites = bucket();
    await expect(
      deleteAccount(repo, { assets, sites }, user.id, site, 'wrong'),
    ).rejects.toMatchObject({ code: 'confirmation' });
    await expect(
      deleteAccount(repo, { assets, sites }, 'other', site, 'maria'),
    ).rejects.toMatchObject({ status: 403 });
    expect(sites.list).not.toHaveBeenCalled();
    expect(repo.deleteUser).not.toHaveBeenCalled();
  });
  it('refuses an object outside the account prefix', async () => {
    const storage = bucket();
    storage.list.mockResolvedValue({
      objects: [{ key: 'other-account/image' }],
      truncated: false,
    });
    await expect(clearPrefix(storage, 'assets/user/')).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

it('redirects users with an earlier accepted terms version to renewed acceptance', () => {
  expect(postLoginPath({ ...user, termsVersion: '2026-10-v1' }, site)).toBe(
    '/accept-terms',
  );
});
