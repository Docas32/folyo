import { describe, expect, it, vi } from 'vitest';
import { createDb, type Database } from '@folyo/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { pageRepositoryFromDb } from './page-repository';
import { site } from './fixtures.test-helper';
const pageId = '40000000-0000-4000-8000-000000000004';
function setup(result: unknown[]) {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi.fn().mockResolvedValue(result);
  db.batch = batch as Database['batch'];
  const repo = pageRepositoryFromDb(db);
  const queries = () =>
    (batch.mock.calls[0]?.[0] as { getSQL(): SQL }[]).map((query) =>
      new PgDialect().sqlToQuery(query.getSQL()),
    );
  return { repo, batch, queries };
}
describe('page transaction plans', () => {
  it('generates slugs and enforces the page limit after acquiring the shared lock', async () => {
    const { repo, queries, batch } = setup([{}, {}, []]);
    expect(await repo.create(site.id, 'Projetos Ágeis')).toBeUndefined();
    expect(batch).toHaveBeenCalledOnce();
    const plan = queries();
    expect(plan[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(plan[0]?.params).toContain(`editor:${site.id}`);
    expect(plan[1]?.sql).toContain('generate_series');
    expect(plan[1]?.sql).toContain('where not exists');
    expect(plan[1]?.sql).toContain('select count(*)');
    expect(plan[1]?.sql).toContain('max(position) + 1');
    expect(plan[1]?.params).toContain('projetos-ageis');
    expect(plan[1]?.params).toContain(5);
  });
  it('renames title without updating slug and restricts ownership', async () => {
    const { repo, queries } = setup([{}, []]);
    await repo.rename(site.id, pageId, 'New');
    expect(queries()[1]?.sql).toContain('set "title"');
    expect(queries()[1]?.sql).not.toContain('"slug" =');
    expect(queries()[1]?.params).toContain(site.id);
    expect(queries()[1]?.params).toContain(pageId);
  });
  it('checks the sole-page rule within the delete transaction', async () => {
    const { repo, queries } = setup([{}, []]);
    expect(await repo.remove(site.id, pageId)).toBe(false);
    expect(queries()[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(queries()[1]?.sql).toContain('select count(*)');
    expect(queries()[1]?.sql).toContain('> 1');
  });
  it('reorders atomically with exact-set and uniqueness guards', async () => {
    const { repo, batch, queries } = setup([{}, []]);
    expect(await repo.reorder(site.id, [pageId])).toBe(false);
    expect(batch).toHaveBeenCalledOnce();
    expect(queries()).toHaveLength(2);
    expect(queries()[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(queries()[1]?.sql).toContain('with ordinality');
    expect(queries()[1]?.sql).toContain('not exists');
    expect(queries()[1]?.sql).toContain('count(distinct value)');
  });
});
