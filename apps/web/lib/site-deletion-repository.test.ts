import { describe, expect, it, vi } from 'vitest';
import {
  createDb,
  pages,
  blocks,
  publications,
  reports,
  type Database,
} from '@folyo/db';
import { PgDialect, getTableConfig } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { siteDeletionRepositoryFromDb } from './site-deletion-repository';
import { site, user, now } from './fixtures.test-helper';
function setup() {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi.fn();
  db.batch = batch as Database['batch'];
  const find = vi.spyOn(db.query.sites, 'findFirst');
  return { repo: siteDeletionRepositoryFromDb(db), batch, find };
}
describe('portfolio deletion transaction', () => {
  it('uses one atomic transaction for owner-guarded cascade, assets and durable cleanup', async () => {
    const f = setup();
    f.batch.mockResolvedValue([
      {},
      {
        rows: [
          {
            siteId: site.id,
            userId: user.id,
            handle: site.handle,
            assetKeys: ['key'],
            createdAt: now.toISOString(),
          },
        ],
      },
    ]);
    expect(await f.repo.remove(site.id, user.id)).toMatchObject({
      siteId: site.id,
      createdAt: now,
    });
    const queries = (f.batch.mock.calls[0]![0] as { getSQL(): SQL }[]).map(
      (query) => new PgDialect().sqlToQuery(query.getSQL()),
    );
    expect(queries[0]!.sql).toContain('pg_advisory_xact_lock');
    expect(queries[1]!.sql).toContain('delete from sites');
    expect(queries[1]!.params).toContain(user.id);
    expect(queries[1]!.sql).toContain(
      'delete from assets where user_id in (select user_id from deleted_site)',
    );
    expect(queries[1]!.sql).toContain('insert into site_deletions');
    expect(queries[1]!.sql).toContain(
      'not exists (select 1 from publication_operations',
    );
    expect(queries[1]!.sql).not.toContain('delete from users');
    for (const table of [pages, blocks, publications, reports])
      expect(
        getTableConfig(table).foreignKeys.every(
          (key) => key.onDelete === 'cascade',
        ),
      ).toBe(true);
  });
  it('returns 404 when no owner row was removed', async () => {
    const f = setup();
    f.batch.mockResolvedValue([{}, { rows: [] }]);
    f.find.mockResolvedValue(undefined);
    await expect(f.repo.remove(site.id, user.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('prevents an in-flight publication from resurrecting a deleted site', async () => {
    const f = setup();
    f.batch.mockResolvedValue([{}, { rows: [] }]);
    f.find.mockResolvedValue(site);
    await expect(f.repo.remove(site.id, user.id)).rejects.toMatchObject({
      status: 409,
      code: 'publicationBusy',
    });
  });
});
