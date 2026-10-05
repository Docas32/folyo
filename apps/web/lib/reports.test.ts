import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./runtime', () => ({ reportsRepository: vi.fn() }));
vi.mock('./session', () => ({ accountContext: vi.fn() }));
import { reportsRepository } from './runtime';
import { accountContext } from './session';
import { POST } from '../app/api/reports/route';
import { PATCH } from '../app/api/admin/reports/[id]/route';
import { ReportLimiter } from './report-service';
import { adminContext } from './admin-session';
import { isAdminEmail } from './admin-access';
import { user, site, mockRepository } from './fixtures.test-helper';
const submit = vi.fn(),
  list = vi.fn(),
  update = vi.fn();
let ip = 0;
function request(input: unknown, method = 'POST') {
  return new Request('http://localhost:3000/api/reports', {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      'cf-connecting-ip': `192.0.2.${++ip}`,
    },
    body: JSON.stringify(input),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reportsRepository).mockReturnValue({ submit, list, update });
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
});
afterEach(() => vi.unstubAllEnvs());
describe('public reports', () => {
  it('normalizes handles and stores open reports through the repository', async () => {
    const r = await POST(
      request({ handle: ' MARIA ', reason: 'spam', details: 'Context' }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(submit).toHaveBeenCalledWith({
      handle: 'maria',
      reason: 'spam',
      details: 'Context',
      website: '',
    });
  });
  it.each([
    { handle: 'bad!', reason: 'spam' },
    { handle: 'maria', reason: 'invalid' },
    { handle: 'maria', reason: 'spam', details: 'x'.repeat(2001) },
    { handle: 'maria', reason: 'spam', status: 'actioned' },
  ])('rejects invalid input', async (input) => {
    expect((await POST(request(input))).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
  it('accepts and discards the honeypot even if its other fields are nonsense', async () => {
    const r = await POST(
      request({ website: 'bot.example', handle: '?', reason: 'fake' }),
    );
    expect(await r.json()).toEqual({ ok: true });
    expect(submit).not.toHaveBeenCalled();
  });
  it('returns the same neutral response for absent handles', async () => {
    submit.mockResolvedValue(undefined);
    expect(
      await (
        await POST(request({ handle: 'does-not-exist', reason: 'other' }))
      ).json(),
    ).toEqual({ ok: true });
  });
  it('limits each IP to five reports a minute', async () => {
    const base = request({ handle: 'maria', reason: 'phishing' });
    for (let index = 0; index < 5; index++)
      expect(
        (await POST(base.clone() as Parameters<typeof POST>[0])).status,
      ).toBe(200);
    const r = await POST(base.clone() as Parameters<typeof POST>[0]);
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('60');
    expect(submit).toHaveBeenCalledTimes(5);
  });
  it('expires limit windows and isolates IPs', () => {
    const limiter = new ReportLimiter();
    for (let index = 0; index < 5; index++)
      expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 1)).toBe(false);
    expect(limiter.allow('b', 1)).toBe(true);
    expect(limiter.allow('a', 60000)).toBe(true);
  });
});
describe('moderation access', () => {
  it('uses an exact, case-insensitive allowlist', () => {
    expect(
      isAdminEmail('TEST@EXAMPLE.COM', ' other@example.com, test@example.com '),
    ).toBe(true);
    expect(isAdminEmail('test@example.com.evil', 'test@example.com')).toBe(
      false,
    );
    expect(isAdminEmail(null, 'test@example.com')).toBe(false);
  });
  it('returns 404 to non-admin sessions', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'other@example.com');
    await expect(adminContext()).rejects.toMatchObject({ status: 404 });
    const r = await PATCH(request({ status: 'reviewed' }, 'PATCH'), {
      params: Promise.resolve({ id: site.id }),
    });
    expect(r.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
  it('admin can mark a report reviewed without changing site content', async () => {
    vi.stubEnv('ADMIN_EMAILS', user.email);
    update.mockResolvedValue(true);
    const r = await PATCH(request({ status: 'reviewed' }, 'PATCH'), {
      params: Promise.resolve({ id: site.id }),
    });
    expect(r.status).toBe(200);
    expect(update).toHaveBeenCalledWith(site.id, 'reviewed');
  });
  it('validates status and rejects forged origins', async () => {
    vi.stubEnv('ADMIN_EMAILS', user.email);
    expect(
      (
        await PATCH(request({ status: 'open' }, 'PATCH'), {
          params: Promise.resolve({ id: site.id }),
        })
      ).status,
    ).toBe(400);
    const r = request({ status: 'actioned' }, 'PATCH');
    r.headers.set('origin', 'https://evil.example');
    expect(
      (await PATCH(r, { params: Promise.resolve({ id: site.id }) })).status,
    ).toBe(403);
  });
});
