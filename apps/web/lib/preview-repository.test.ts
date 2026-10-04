import { describe, expect, it, vi } from 'vitest';
import { createDb, type Database } from '@folyo/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { previewRepositoryFromDb } from './preview-repository';
describe('preview read scope', () => {
  it('restricts every query to the requested site, orders content, and projects only public owner data', async () => {
    const db = createDb('postgres://test:test@localhost/db');
    const batch = vi.fn().mockResolvedValue([[], [], []]);
    db.batch = batch as Database['batch'];
    expect(await previewRepositoryFromDb(db).read('site-id')).toBeUndefined();
    const queries = (batch.mock.calls[0]![0] as { getSQL(): SQL }[]).map(
      (query) => new PgDialect().sqlToQuery(query.getSQL()),
    );
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.params).toEqual(['site-id']);
      expect(query.sql).toContain('where');
    }
    expect(queries[0]!.sql).toContain('"users"."locale"');
    expect(queries[0]!.sql).not.toContain('"email"');
    expect(queries[1]!.sql).toContain('order by "pages"."position" asc');
    expect(queries[2]!.sql).toContain('inner join "pages"');
    expect(queries[2]!.sql).toContain('"pages"."site_id"');
    expect(queries[2]!.sql).toContain('order by "blocks"."position" asc');
  });
});
