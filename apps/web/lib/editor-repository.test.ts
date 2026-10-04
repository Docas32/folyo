import { describe, expect, it, vi } from 'vitest';
import { createDb, type Database } from '@folyo/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { createDefaultBlock, type EditorBlock } from '@folyo/core';
import { editorRepositoryFromDb } from './editor-repository';
import { initialPage } from './editor-service';
import { site } from './fixtures.test-helper';
const page = {
  id: '40000000-0000-4000-8000-000000000004',
  siteId: site.id,
  title: 'Início',
  slug: 'inicio',
  position: 0,
};
const block: EditorBlock = {
  id: '30000000-0000-4000-8000-000000000003',
  position: 0,
  type: 'hero',
  content: createDefaultBlock('hero', 'pt-BR'),
};
const dialect = new PgDialect();
function compile(query: unknown) {
  return dialect.sqlToQuery((query as { getSQL(): SQL }).getSQL());
}
function dbWithMockBatch() {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi.fn();
  db.batch = batch as Database['batch'];
  return { db, batch, repo: editorRepositoryFromDb(db) };
}
describe('editor transaction plans', () => {
  it('bootstraps with a per-site transaction lock and hero derived only from the inserted page', async () => {
    const { repo, batch } = dbWithMockBatch();
    batch.mockResolvedValue([{}, {}, [page], [block]]);
    const result = await repo.bootstrapAndRead(site.id, 'pt-BR');
    expect(result).toEqual({ pages: [page], blocks: [block] });
    const queries = (batch.mock.calls[0]?.[0] as unknown[]).map(compile);
    expect(queries).toHaveLength(4);
    expect(queries[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(queries[0]?.params).toContain(`editor:${site.id}`);
    expect(queries[1]?.sql).toContain('where not exists (select 1 from pages');
    expect(queries[1]?.sql).toContain('from new_page');
    expect(queries[1]?.params).toContain('Início');
    expect(queries[1]?.params).toContain(
      JSON.stringify(createDefaultBlock('hero', 'pt-BR')),
    );
    expect(queries[2]?.params).toContain(site.id);
    expect(queries[3]?.sql).toContain('in (select id from pages where site_id');
    expect(queries[3]?.sql).not.toContain('limit 1');
  });
  it('serializes concurrent bootstrap calls in a mocked transaction and preserves intentionally empty pages', async () => {
    const { repo, batch } = dbWithMockBatch();
    let storedPages: (typeof page)[] = [];
    let storedBlocks: EditorBlock[] = [];
    let inserts = 0;
    let previous = Promise.resolve();
    batch.mockImplementation((input: unknown[]) => {
      const next = previous.then(() => {
        const queries = input.map(compile);
        // Model the guarded CTE only after acquiring the transaction lock.
        expect(queries[0]?.sql).toContain('pg_advisory_xact_lock');
        expect(queries[1]?.sql).toContain(
          'where not exists (select 1 from pages',
        );
        expect(queries[1]?.sql).toContain('from new_page');
        if (storedPages.length === 0) {
          storedPages = [page];
          storedBlocks = [block];
          inserts++;
        }
        return [{}, {}, [...storedPages], [...storedBlocks]];
      });
      previous = next.then(() => {});
      return next;
    });
    const [first, second] = await Promise.all([
      repo.bootstrapAndRead(site.id, 'pt-BR'),
      repo.bootstrapAndRead(site.id, 'pt-BR'),
    ]);
    expect(inserts).toBe(1);
    expect(first.pages).toEqual(second.pages);
    expect(second.blocks).toHaveLength(1);
    storedBlocks = [];
    expect((await repo.bootstrapAndRead(site.id, 'pt-BR')).blocks).toEqual([]);
    expect(inserts).toBe(1);
  });
  it('uses English bootstrap fields for non-Portuguese locales', () => {
    expect(initialPage('other')).toMatchObject({
      title: 'Home',
      slug: 'home',
      hero: createDefaultBlock('hero', 'en'),
    });
  });
  it('replaces blocks in a single locked transaction, updates site time, and does not upsert foreign block IDs', async () => {
    const { repo, batch } = dbWithMockBatch();
    batch.mockResolvedValue([
      {},
      {},
      {},
      [{ savedAt: new Date('2026-10-03T12:00:00.000Z') }],
    ]);
    expect(await repo.replaceBlocks(site.id, page.id, [block])).toBe(
      '2026-10-03T12:00:00.000Z',
    );
    const queries = (batch.mock.calls[0]?.[0] as unknown[]).map(compile);
    expect(queries[0]?.sql).toContain('pg_advisory_xact_lock');
    expect(queries[1]?.sql).toContain('delete from "blocks"');
    expect(queries[1]?.params).toContain(site.id);
    expect(queries[1]?.params).toContain(page.id);
    expect(queries[2]?.sql).toContain('insert into "blocks"');
    expect(queries[2]?.params).toContain(block.id);
    expect(queries[2]?.params).toContain(page.id);
    expect(queries[2]?.sql).not.toContain('on conflict');
    expect(queries[3]?.sql).toContain('clock_timestamp()');
  });
  it('supports an empty list without an invalid zero-row INSERT', async () => {
    const { repo, batch } = dbWithMockBatch();
    batch.mockResolvedValue([
      {},
      {},
      [{ savedAt: new Date('2026-10-03T12:00:00.000Z') }],
    ]);
    await repo.replaceBlocks(site.id, page.id, []);
    const queries = (batch.mock.calls[0]?.[0] as unknown[]).map(compile);
    expect(queries).toHaveLength(3);
    expect(queries.some((query) => query.sql.includes('insert'))).toBe(false);
  });
  it('propagates transaction failures without returning a successful save', async () => {
    const { repo, batch } = dbWithMockBatch();
    batch.mockRejectedValue({ code: '23505' });
    await expect(
      repo.replaceBlocks(site.id, page.id, [block]),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
