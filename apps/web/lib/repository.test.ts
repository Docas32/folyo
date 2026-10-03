import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@folyo/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@folyo/db')>();
  return { ...actual, createDb: vi.fn() };
});
import { createDb, sites, users } from '@folyo/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { createRepository } from './repository';
import { now, site, user } from './fixtures.test-helper';
const findSite = vi.fn();
const returning = vi.fn();
const where = vi.fn();
const set = vi.fn();
const values = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const deleteWhere = vi.fn();
const deleteQuery = { operation: 'delete' };
const deleteFn = vi.fn();
const batch = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  findSite.mockResolvedValue(site);
  returning.mockResolvedValue([{ id: site.id }]);
  where.mockReturnValue({ returning });
  set.mockReturnValue({ where });
  values.mockResolvedValue(undefined);
  insert.mockReturnValue({ values });
  update.mockReturnValue({ set });
  deleteWhere.mockReturnValue(deleteQuery);
  deleteFn.mockReturnValue({ where: deleteWhere });
  batch.mockResolvedValue([]);
  vi.mocked(createDb).mockReturnValue({
    query: { sites: { findFirst: findSite } },
    insert,
    update,
    delete: deleteFn,
    batch,
  } as unknown as ReturnType<typeof createDb>);
});
describe('Drizzle account repository', () => {
  it('creates the minimal draft/blank site with the authenticated owner', async () => {
    const repo = createRepository('postgres://test:test@localhost/db');
    await repo.createSite(user.id, 'maria');
    expect(insert).toHaveBeenCalledWith(sites);
    expect(values).toHaveBeenCalledWith({
      userId: user.id,
      handle: 'maria',
      templateId: 'blank',
      status: 'draft',
    });
  });
  it('sets handle_changed_at and enforces cooldown and owner atomically', async () => {
    const repo = createRepository('postgres://test:test@localhost/db');
    expect(
      await repo.updateSite(user.id, site.id, { handle: 'other' }, now),
    ).toBe(true);
    expect(set).toHaveBeenCalledWith({
      handle: 'other',
      updatedAt: now,
      handleChangedAt: now,
    });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0]?.[0] as SQL);
    expect(query.sql).toContain('"sites"."user_id"');
    expect(query.sql).toContain('"sites"."handle_changed_at" <=');
    expect(query.sql).toContain('"sites"."handle_changed_at" is null');
    expect(query.params).toContain(user.id);
    expect(query.params).toContain('2026-09-26T12:00:00.000Z');
  });
  it('does not change the cooldown when saving metadata', async () => {
    const repo = createRepository('postgres://test:test@localhost/db');
    await repo.updateSite(user.id, site.id, { title: 'Title' }, now);
    expect(set).toHaveBeenCalledWith({ title: 'Title', updatedAt: now });
  });
  it('deletes only the authenticated user in a Neon batch transaction', async () => {
    const repo = createRepository('postgres://test:test@localhost/db');
    await repo.deleteUser(user.id);
    expect(deleteFn).toHaveBeenCalledWith(users);
    expect(batch).toHaveBeenCalledWith([deleteQuery]);
    const query = new PgDialect().sqlToQuery(
      deleteWhere.mock.calls[0]?.[0] as SQL,
    );
    expect(query.params).toEqual([user.id]);
  });
});
