import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '@folyo/core';
vi.mock('./session', () => ({ accountContext: vi.fn() }));
vi.mock('./runtime', () => ({ templateRepository: vi.fn() }));
import { accountContext } from './session';
import { templateRepository } from './runtime';
import { POST } from '../app/api/site/template/route';
import { PATCH } from '../app/api/site/theme/route';
import { POST as STYLE } from '../app/api/site/template/style/route';
import { site, user, mockRepository } from './fixtures.test-helper';
const repo = { apply: vi.fn(), patch: vi.fn() };
function request(method: string, data: unknown) {
  return new Request('http://localhost:3000/api/site/template', {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
  vi.mocked(templateRepository).mockReturnValue(repo);
  repo.apply.mockResolvedValue({
    appliedTheme: true,
    contentSkipped: false,
    theme: DEFAULT_THEME,
  });
  repo.patch.mockImplementation(async (_siteId, _userId, patch) => ({
    ...DEFAULT_THEME,
    ...patch,
  }));
});
describe('template API', () => {
  it('explicitly preserves content for dashboard style choices, even on a virgin site', async () => {
    repo.apply.mockResolvedValue({
      appliedTheme: true,
      contentSkipped: true,
      theme: DEFAULT_THEME,
    });
    const response = await POST(
      request('POST', { templateId: 'professional', applyContent: false }),
    );
    expect(response.status).toBe(409);
    expect(repo.apply).toHaveBeenCalledWith(
      site.id,
      user.id,
      expect.anything(),
      false,
    );
    expect(await response.json()).toMatchObject({
      appliedTheme: true,
      contentSkipped: true,
    });
  });
  it('applies content and theme to virgin sites using authenticated ownership', async () => {
    const response = await POST(request('POST', { templateId: 'creative' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      appliedTheme: true,
      contentSkipped: false,
    });
    expect(repo.apply).toHaveBeenCalledWith(
      site.id,
      user.id,
      expect.objectContaining({
        theme: expect.objectContaining({ preset: 'creative' }),
        pages: expect.any(Array),
      }),
    );
  });
  it('returns 409 after applying theme while preserving non-virgin content', async () => {
    repo.apply.mockResolvedValue({
      appliedTheme: true,
      contentSkipped: true,
      theme: DEFAULT_THEME,
    });
    const response = await POST(request('POST', { templateId: 'minimal' }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      appliedTheme: true,
      contentSkipped: true,
    });
  });
  it('offers an explicit style action that never replaces virgin content', async () => {
    expect(
      (await STYLE(request('POST', { templateId: 'minimal' }))).status,
    ).toBe(200);
    expect(repo.apply).toHaveBeenCalledWith(
      site.id,
      user.id,
      expect.any(Object),
      false,
    );
  });
  it.each([
    { templateId: 'invalid' },
    { templateId: 'minimal', siteId: 'other' },
    {},
  ])('rejects invalid template input %j', async (data) => {
    expect((await POST(request('POST', data))).status).toBe(400);
    expect(repo.apply).not.toHaveBeenCalled();
  });
  it.each([POST, PATCH, STYLE])(
    'enforces ownership before writing',
    async (handler) => {
      vi.mocked(accountContext).mockResolvedValue({
        user,
        site: { ...site, userId: 'other' },
        repo: mockRepository(),
      });
      expect(
        (
          await handler(
            request(handler === PATCH ? 'PATCH' : 'POST', {
              templateId: 'blank',
            }),
          )
        ).status,
      ).toBe(403);
      expect(repo.apply).not.toHaveBeenCalled();
      expect(repo.patch).not.toHaveBeenCalled();
    },
  );
  it('requires authentication, terms and same origin', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      user: { ...user, termsAcceptedAt: null },
      site,
      repo: mockRepository(),
    });
    expect((await POST(request('POST', { templateId: 'blank' }))).status).toBe(
      403,
    );
    expect(
      (
        await POST(
          new Request('http://localhost:3000/api/site/template', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(403);
  });
});
describe('theme PATCH API', () => {
  it('merges a partial patch and returns the complete theme', async () => {
    const response = await PATCH(request('PATCH', { accent: '#1E5AA8' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      theme: { ...DEFAULT_THEME, accent: '#1E5AA8' },
    });
    expect(repo.patch).toHaveBeenCalledWith(site.id, user.id, {
      accent: '#1E5AA8',
    });
  });
  it.each([
    { accent: 'red' },
    { accent: '#123456' },
    { accent: '#fff' },
    { headingFont: 'comic-sans' },
    { bodyFont: 'lora' },
    { heroLayout: 'right' },
    { preset: 'creative' },
    { unknown: true },
    {},
  ])('rejects invalid patch %j', async (data) => {
    expect((await PATCH(request('PATCH', data))).status).toBe(400);
    expect(repo.patch).not.toHaveBeenCalled();
  });
});
