import { expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { createDb, type Database } from '@folyo/db';
import { publishRepositoryFromDb } from './repository';
import { site } from '../fixtures.test-helper';
const dialect = new PgDialect();
const compile = (query: unknown) =>
  dialect.sqlToQuery((query as { getSQL(): SQL }).getSQL());
it('captures all publication data atomically behind the editor lock and durable exclusive operation', async () => {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi
    .fn()
    .mockResolvedValue([
      {},
      [{ token: 'token' }],
      [{ site, locale: 'en' }],
      [],
      [],
    ]);
  db.batch = batch as Database['batch'];
  await publishRepositoryFromDb(db).acquire(site.id, site.userId, 'token');
  const queries = batch.mock.calls[0]![0].map(compile);
  expect(queries[0].sql).toContain('pg_advisory_xact_lock');
  expect(queries[1].sql).toContain('insert into "publication_operations"');
  expect(queries[1].sql).toContain('on conflict do nothing');
  expect(queries[2].params).toContain(site.userId);
  expect(queries[3].sql).toContain('order by "pages"."position" asc');
  expect(queries[4].sql).toContain(
    'order by "pages"."position" asc, "blocks"."position" asc',
  );
});
it('rejects a competing operation and only releases its own token', async () => {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi
    .fn()
    .mockResolvedValue([{}, [], [{ site, locale: 'en' }], [], []]);
  db.batch = batch as Database['batch'];
  const repo = publishRepositoryFromDb(db);
  await expect(
    repo.acquire(site.id, site.userId, 'token'),
  ).rejects.toMatchObject({ code: 'publicationBusy', status: 409 });
  await repo.release(site.id, 'token');
  const queries = batch.mock.calls[1]![0].map(compile);
  expect(queries[1].sql).toContain('"publication_operations"."token" =');
  expect(queries[1].params).toContain('token');
  expect(queries[2].sql).toContain('update assets');
});
