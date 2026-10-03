import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../auth', () => ({ auth: vi.fn() }));
vi.mock('./runtime', () => ({ repository: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
import { auth } from '../auth';
import { repository } from './runtime';
import { accountContext, pageAccount } from './session';
import { mockRepository, site, user } from './fixtures.test-helper';
import { getDictionary } from './i18n';
let repo = mockRepository();
beforeEach(() => {
  vi.resetAllMocks();
  repo = mockRepository();
  vi.mocked(repository).mockReturnValue(repo);
  vi.mocked(auth).mockResolvedValue({
    user: { id: user.id },
    expires: '2026-11-01T00:00:00.000Z',
  } as never);
});
describe('server account access', () => {
  it('rejects anonymous requests before querying the database', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(accountContext()).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
    expect(repository).not.toHaveBeenCalled();
  });
  it('rejects a valid JWT whose account was deleted', async () => {
    repo.findUser.mockResolvedValue(undefined);
    await expect(accountContext()).rejects.toMatchObject({ status: 401 });
    expect(repo.findSite).not.toHaveBeenCalled();
  });
  it('looks up only the authenticated user and their site', async () => {
    repo.findSite.mockResolvedValue(site);
    const result = await accountContext(repo);
    expect(repo.findUser).toHaveBeenCalledWith(user.id);
    expect(repo.findSite).toHaveBeenCalledWith(user.id);
    expect(result.site).toBe(site);
  });
  it('blocks dashboard access before terms acceptance even with a site', async () => {
    repo.findUser.mockResolvedValue({ ...user, termsAcceptedAt: null });
    repo.findSite.mockResolvedValue(site);
    await expect(pageAccount('app')).rejects.toThrow('redirect:/accept-terms');
  });
  it('blocks onboarding access before terms acceptance', async () => {
    repo.findUser.mockResolvedValue({ ...user, termsAcceptedAt: null });
    await expect(pageAccount('onboarding')).rejects.toThrow(
      'redirect:/accept-terms',
    );
  });
  it('sends users without a site to onboarding', async () => {
    await expect(pageAccount('app')).rejects.toThrow('redirect:/onboarding');
  });
  it('prevents returning to terms or onboarding after completion', async () => {
    repo.findSite.mockResolvedValue(site);
    await expect(pageAccount('terms')).rejects.toThrow('redirect:/dashboard');
    await expect(pageAccount('onboarding')).rejects.toThrow(
      'redirect:/dashboard',
    );
    expect((await pageAccount('app')).user.id).toBe(user.id);
  });
  it('uses the stored supported locale with English fallback', () => {
    expect(getDictionary('pt-BR').draft).toBe('Rascunho');
    expect(getDictionary('unknown')).toBe(getDictionary('en'));
  });
});
