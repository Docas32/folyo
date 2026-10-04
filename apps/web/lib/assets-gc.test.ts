import { describe, expect, it, vi } from 'vitest';
import { collectAssets } from './assets-gc';
import type { gcRepository } from './assets-gc';
import type { ObjectStorage } from '@folyo/db/storage';
function fixtures() {
  const expired = vi.fn().mockResolvedValue([
    { id: '1', r2Key: 'a' },
    { id: '2', r2Key: 'b' },
  ]);
  const remove = vi.fn().mockResolvedValue({});
  const deleteObject = vi.fn().mockResolvedValue(undefined);
  const repo = () =>
    ({ expired, remove }) as unknown as ReturnType<typeof gcRepository>;
  const storage = () => ({ deleteObject }) as unknown as ObjectStorage;
  return { expired, remove, deleteObject, repo, storage };
}
const authorized = () =>
  new Request('http://localhost/api/cron/assets-gc', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret' },
  });
describe('assets GC endpoint', () => {
  it('rejects absent/wrong/unconfigured secrets without accessing storage', async () => {
    const f = fixtures();
    for (const [request, secret] of [
      [new Request('http://localhost'), 'secret'],
      [authorized(), 'wrong'],
      [authorized(), undefined],
    ] as const) {
      expect(
        (await collectAssets(request, secret, undefined, f.repo, f.storage))
          .status,
      ).toBe(401);
    }
    expect(f.expired).not.toHaveBeenCalled();
  });
  it('deletes objects before rows and returns keys; empty reruns are idempotent', async () => {
    const f = fixtures();
    const response = await collectAssets(
      authorized(),
      'secret',
      undefined,
      f.repo,
      f.storage,
    );
    expect(await response.json()).toEqual({ deleted: 2, keys: ['a', 'b'] });
    expect(f.deleteObject.mock.invocationCallOrder[0]).toBeLessThan(
      f.remove.mock.invocationCallOrder[0]!,
    );
    expect(f.expired.mock.calls[0]![0].getTime()).toBeCloseTo(
      Date.now() - 7 * 86400000,
      -3,
    );
    f.expired.mockResolvedValue([]);
    expect(
      await (
        await collectAssets(authorized(), 'secret', '7', f.repo, f.storage)
      ).json(),
    ).toEqual({ deleted: 0, keys: [] });
  });
  it('continues after a failed R2 deletion, preserving its row', async () => {
    const f = fixtures();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    f.deleteObject.mockRejectedValueOnce(new Error('R2'));
    expect(
      await (
        await collectAssets(authorized(), 'secret', '7', f.repo, f.storage)
      ).json(),
    ).toEqual({ deleted: 1, keys: ['b'] });
    expect(f.remove).toHaveBeenCalledTimes(1);
    expect(f.remove).toHaveBeenCalledWith('2', expect.any(Date));
  });
});
