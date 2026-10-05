import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./runtime', () => ({
  faviconRepository: vi.fn(),
  objectStorage: vi.fn(),
}));
vi.mock('./session', () => ({ accountContext: vi.fn() }));
import { faviconRepository, objectStorage } from './runtime';
import { accountContext } from './session';
import { POST, DELETE } from '../app/api/site/favicon/route';
import { mockRepository, user, site } from './fixtures.test-helper';
const save = vi.fn(),
  reset = vi.fn(),
  putObject = vi.fn(),
  deleteObject = vi.fn();
function request(
  content = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h64v64Z"/></svg>',
  mime = 'image/svg+xml',
) {
  const form = new FormData();
  form.set('file', new File([content], 'icon.svg', { type: mime }));
  return new Request('http://localhost:3000/api/site/favicon', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
    body: form,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(accountContext).mockResolvedValue({
    user,
    site,
    repo: mockRepository(),
  });
  vi.mocked(faviconRepository).mockReturnValue({ save, reset });
  vi.mocked(objectStorage).mockReturnValue({
    putObject,
    deleteObject,
    getObject: vi.fn(),
  });
  save.mockResolvedValue(true);
  reset.mockResolvedValue(true);
});
describe('portfolio favicon API', () => {
  it('uploads and persists an owned icon with a unique asset URL', async () => {
    const r = await POST(request());
    expect(r.status).toBe(201);
    const data = (await r.json()) as { faviconKey: string; url: string };
    expect(data.faviconKey).toMatch(new RegExp(`^assets/${user.id}/.+\\.svg$`));
    expect(data.url).toBe(`/api/assets/${data.faviconKey}`);
    expect(save).toHaveBeenCalledWith(
      site.id,
      user.id,
      data.faviconKey,
      'image/svg+xml',
      expect.any(Number),
    );
    expect(putObject).toHaveBeenCalledOnce();
  });
  it('rejects oversize and active SVG before writing storage', async () => {
    expect(
      (await POST(request('x'.repeat(256 * 1024 + 1), 'image/png'))).status,
    ).toBe(413);
    expect(
      (
        await POST(
          request('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        )
      ).status,
    ).toBe(415);
    expect(putObject).not.toHaveBeenCalled();
  });
  it('enforces ownership and same-origin access', async () => {
    vi.mocked(accountContext).mockResolvedValue({
      user,
      site: { ...site, userId: 'other' },
      repo: mockRepository(),
    });
    expect((await POST(request())).status).toBe(404);
    const r = request();
    r.headers.set('origin', 'https://evil.example');
    expect((await POST(r)).status).toBe(403);
    expect(putObject).not.toHaveBeenCalled();
  });
  it('compensates an icon that cannot be persisted', async () => {
    save.mockRejectedValue(Error('DB unavailable'));
    expect((await POST(request())).status).toBe(503);
    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringContaining(`assets/${user.id}/`),
    );
  });
  it('restores the default using the owned site', async () => {
    const r = await DELETE(
      new Request('http://localhost:3000/api/site/favicon', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3000' },
      }),
    );
    expect(await r.json()).toEqual({ url: '/favicon.svg', faviconKey: null });
    expect(reset).toHaveBeenCalledWith(site.id, user.id);
  });
});
