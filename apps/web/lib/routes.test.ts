import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../auth', () => ({ signOut: vi.fn() }));
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({ accountBuckets: vi.fn() }));
import { signOut } from '../auth';
import { accountContext } from './session';
import { accountBuckets } from './runtime';
import { GET } from '../app/api/handle/check/route';
import { POST } from '../app/api/onboarding/route';
import { POST as acceptTerms } from '../app/api/account/accept-terms/route';
import { PATCH } from '../app/api/site/route';
import { DELETE } from '../app/api/account/route';
import { AccountError } from './account-service';
import { mockRepository, site, user } from './fixtures.test-helper';
let repo = mockRepository();
const req = (path: string, method = 'GET', data?: unknown) =>
  new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  repo = mockRepository();
  vi.mocked(accountContext).mockResolvedValue({ repo, user, site: undefined });
});
describe('account API', () => {
  it('checks normalized handle availability', async () => {
    const response = await GET(req('/api/handle/check?handle=%20MARIA%20'));
    expect(await response.json()).toEqual({ available: true });
    expect(repo.isTaken).toHaveBeenCalledWith('maria', undefined);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it.each([
    ['-abc', 'invalid'],
    ['app', 'reserved'],
  ])('returns %s reason', async (handle, reason) => {
    expect(
      await (await GET(req(`/api/handle/check?handle=${handle}`))).json(),
    ).toEqual({ available: false, reason });
  });
  it('returns taken for existing handles', async () => {
    repo.isTaken.mockResolvedValue(true);
    expect(
      await (await GET(req('/api/handle/check?handle=maria'))).json(),
    ).toEqual({ available: false, reason: 'taken' });
  });
  it('creates the site using the authenticated user', async () => {
    const response = await POST(
      req('/api/onboarding', 'POST', { handle: '  MARIA ' }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ redirect: '/dashboard' });
    expect(repo.createSite).toHaveBeenCalledWith(user.id, 'maria');
  });
  it('returns 409 when insert loses the unique race', async () => {
    repo.createSite.mockRejectedValue({ cause: { code: '23505' } });
    const response = await POST(
      req('/api/onboarding', 'POST', { handle: 'maria' }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'taken' });
  });
  it('rejects attempts to provide another user_id', async () => {
    expect(
      (
        await POST(
          req('/api/onboarding', 'POST', {
            handle: 'maria',
            userId: 'someone-else',
          }),
        )
      ).status,
    ).toBe(400);
    expect(repo.createSite).not.toHaveBeenCalled();
  });
  it('requires authentication', async () => {
    vi.mocked(accountContext).mockRejectedValue(
      new AccountError('unauthorized', 401),
    );
    expect((await GET(req('/api/handle/check?handle=maria'))).status).toBe(401);
    expect(
      (await POST(req('/api/onboarding', 'POST', { handle: 'maria' }))).status,
    ).toBe(401);
  });
  it('requires terms for onboarding and handle checks', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      repo,
      user: { ...user, termsAcceptedAt: null },
      site: undefined,
    });
    expect(
      (await POST(req('/api/onboarding', 'POST', { handle: 'maria' }))).status,
    ).toBe(403);
    expect((await GET(req('/api/handle/check?handle=maria'))).status).toBe(403);
  });
  it('requires same-origin mutations', async () => {
    const request = req('/api/onboarding', 'POST', { handle: 'maria' });
    request.headers.set('origin', 'https://evil.example');
    expect((await POST(request)).status).toBe(403);
    expect(repo.createSite).not.toHaveBeenCalled();
  });
  it('stores the fixed terms version without client-controlled timestamps', async () => {
    const response = await acceptTerms(
      req('/api/account/accept-terms', 'POST', { accepted: true }),
    );
    expect(repo.acceptTerms).toHaveBeenCalledWith(
      user.id,
      '2026-10-v1',
      expect.any(Date),
    );
    expect(await response.json()).toEqual({ redirect: '/onboarding' });
    expect(
      (
        await acceptTerms(
          req('/api/account/accept-terms', 'POST', { accepted: false }),
        )
      ).status,
    ).toBe(400);
  });
  it('validates metadata limits and site ownership', async () => {
    vi.mocked(accountContext).mockResolvedValue({ repo, user, site });
    expect(
      (await PATCH(req('/api/site', 'PATCH', { title: 'x'.repeat(121) })))
        .status,
    ).toBe(400);
    expect(
      (await PATCH(req('/api/site', 'PATCH', { description: 'x'.repeat(301) })))
        .status,
    ).toBe(400);
    expect(
      (await PATCH(req('/api/site', 'PATCH', { title: 'New title' }))).status,
    ).toBe(200);
    expect(repo.updateSite).toHaveBeenCalledWith(
      user.id,
      site.id,
      { title: 'New title' },
      expect.any(Date),
    );
    vi.mocked(accountContext).mockResolvedValue({
      repo,
      user,
      site: { ...site, userId: 'another-user' },
    });
    expect(
      (await PATCH(req('/api/site', 'PATCH', { title: 'x' }))).status,
    ).toBe(403);
  });
  it('rejects malformed JSON', async () => {
    const request = new Request('http://localhost:3000/api/onboarding', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body: '{',
    });
    expect((await POST(request)).status).toBe(400);
  });
  it('returns no infrastructure details on failure', async () => {
    repo.isTaken.mockRejectedValue(new Error('postgres://private-credentials'));
    const response = await GET(req('/api/handle/check?handle=maria'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
  it('deletes the authenticated account and returns home for logout', async () => {
    vi.mocked(accountContext).mockResolvedValue({ repo, user, site });
    const bucket = {
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
      delete: vi.fn(),
    };
    vi.mocked(accountBuckets).mockResolvedValue({
      assets: bucket,
      sites: bucket,
    } as unknown as Awaited<ReturnType<typeof accountBuckets>>);
    const response = await DELETE(
      req('/api/account', 'DELETE', { handle: 'maria' }),
    );
    expect(response.status).toBe(200);
    expect(repo.deleteUser).toHaveBeenCalledWith(user.id);
    expect(await response.json()).toEqual({ redirect: '/' });
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
  });
});
