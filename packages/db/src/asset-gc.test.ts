import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { createDb, type Database } from './index';
import { recomputeOrphans, recomputeOrphansQuery } from './asset-gc';
const db = createDb('postgres://test:test@localhost/db');
const dialect = new PgDialect();
function compile(query: unknown) {
  return dialect.sqlToQuery((query as { getSQL(): SQL }).getSQL());
}
describe('recomputeOrphans transaction', () => {
  it('marks newly unreferenced assets while preserving the original grace timestamp', () => {
    const query = compile(recomputeOrphansQuery(db, { userId: 'owner' }));
    expect(query.sql).toContain('else coalesce(a.orphaned_at, now())');
    expect(query.sql).toContain('where a.user_id =');
    expect(query.params).toContain('owner');
  });
  it('restores referenced assets and considers every block on every page', () => {
    const query = compile(recomputeOrphansQuery(db, { userId: 'owner' }));
    expect(query.sql).toContain(
      'when exists (select 1 from referenced r where r.key = a.r2_key) then null',
    );
    expect(query.sql).toContain('select distinct');
    expect(query.sql).toContain(
      'join pages p on p.id = b.page_id join sites s on s.id = p.site_id',
    );
    expect(query.sql).toContain('jsonb_path_query');
    expect(query.sql).not.toContain('limit');
    // DISTINCT + EXISTS means removing either of two references keeps the asset active.
  });
  it('includes current publication and in-flight asset keys in orphan recomputation', () => {
    const query = compile(recomputeOrphansQuery(db, { userId: 'owner' }));
    expect(query.sql).toContain('jsonb_array_elements_text(pub.assets_keys)');
    expect(query.sql).toContain(
      "s.status = 'published' and pub.version = s.published_version",
    );
    expect(query.sql).toContain('publication_operations op');
  });
  it('runs standalone recomputation behind the same editor transaction lock', async () => {
    const batch = vi.fn().mockResolvedValue([{}, {}]);
    db.batch = batch as Database['batch'];
    await recomputeOrphans('owner', db);
    const queries = batch.mock.calls[0]![0].map(compile);
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('pg_advisory_xact_lock');
    expect(queries[1].sql).toContain('update assets');
  });
});
