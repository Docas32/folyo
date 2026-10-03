import { describe, expect, it, vi } from 'vitest';
import { users, type Database } from '@folyo/db';
import { saveGoogleAccount } from './google-account';
const profile = {
  sub: 'google-123',
  email: 'maria@example.com',
  email_verified: true,
  name: 'Maria',
  picture: 'https://example.com/avatar.jpg',
};
function mockDb() {
  const returning = vi.fn().mockResolvedValue([{ id: 'existing-user-id' }]);
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    db: { insert } as unknown as Pick<Database, 'insert'>,
    insert,
    values,
    onConflictDoUpdate,
  };
}
describe('Google account persistence', () => {
  it('upserts by google_sub and reuses the DB identity on repeated login', async () => {
    const mock = mockDb();
    expect(await saveGoogleAccount(mock.db, profile, 'pt-BR,pt;q=0.9')).toBe(
      'existing-user-id',
    );
    expect(await saveGoogleAccount(mock.db, profile, 'en-US')).toBe(
      'existing-user-id',
    );
    expect(mock.insert).toHaveBeenCalledWith(users);
    expect(mock.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ googleSub: 'google-123', locale: 'pt-BR' }),
    );
    expect(mock.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ locale: 'en' }),
    );
    const conflict = mock.onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(conflict.target).toBe(users.googleSub);
    expect(Object.keys(conflict.set).sort()).toEqual([
      'avatarUrl',
      'email',
      'name',
    ]);
  });
  it.each([
    null,
    {},
    { ...profile, email_verified: false },
    { ...profile, sub: '' },
  ])('rejects unverified or malformed profiles', async (value) => {
    const mock = mockDb();
    expect(await saveGoogleAccount(mock.db, value, null)).toBeNull();
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it('falls back to English without a language header', async () => {
    const mock = mockDb();
    await saveGoogleAccount(mock.db, { ...profile, picture: undefined }, null);
    expect(mock.values).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', avatarUrl: null }),
    );
  });
});
