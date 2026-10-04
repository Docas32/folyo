import { describe, expect, it, vi } from 'vitest';
import { createDb, type Database } from '@folyo/db';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DEFAULT_THEME, createDefaultBlock } from '@folyo/core';
import { templateRepositoryFromDb } from './template-repository';
import { buildTemplate } from './templates';
import { site, user } from './fixtures.test-helper';
function setup() {
  const db = createDb('postgres://test:test@localhost/db');
  const batch = vi.fn();
  db.batch = batch as Database['batch'];
  return { repo: templateRepositoryFromDb(db), batch };
}
const dialect = new PgDialect();
function compile(query: unknown) {
  return dialect.sqlToQuery((query as { getSQL(): SQL }).getSQL());
}
describe('template transactions', () => {
  it('checks untouched content after locking and atomically replaces all pages and blocks', async () => {
    const { repo, batch } = setup();
    batch.mockResolvedValue([
      {},
      {},
      {},
      [{ id: site.id }],
      {},
      {},
      {},
      {},
      { rows: [{ virgin: true }] },
    ]);
    const template = buildTemplate('professional', 'pt-BR');
    expect(await repo.apply(site.id, user.id, template)).toMatchObject({
      contentSkipped: false,
      theme: template.theme,
    });
    const queries = (batch.mock.calls[0]![0] as unknown[]).map(compile);
    expect(queries).toHaveLength(9);
    expect(queries[0]!.sql).toContain('pg_advisory_xact_lock');
    expect(queries[0]!.params).toContain(`editor:${site.id}`);
    expect(queries[1]!.sql).toContain('for update');
    expect(queries[1]!.params).toContain(user.id);
    expect(queries[2]!.sql).toContain("coalesce(s.title, '') = ''");
    expect(queries[2]!.sql).toContain("s.status <> 'published'");
    expect(queries[2]!.params).toContain(
      JSON.stringify(createDefaultBlock('hero', 'pt-BR')),
    );
    expect(queries[2]!.params).toContain(
      JSON.stringify(createDefaultBlock('hero', 'en')),
    );
    expect(queries[3]!.sql).toContain('update "sites"');
    expect(queries[3]!.params).toContain(user.id);
    expect(queries[4]!.sql).toContain('delete from pages');
    for (const query of queries.slice(4, 7))
      expect(query.sql).toContain(
        "current_setting('folyo.template_replace') = 'true'",
      );
    expect(queries[5]!.sql).toContain('insert into pages');
    expect(queries[6]!.sql).toContain('insert into blocks');
    const input = JSON.parse(
      queries[5]!.params.find(
        (param) => typeof param === 'string' && param.startsWith('['),
      ) as string,
    );
    expect(input.map((page: { position: number }) => page.position)).toEqual([
      0, 1, 2,
    ]);
    expect(input[0].blocks[2].content).toMatchObject({
      label: 'Baixar CV',
      url: '#',
    });
    expect(queries[7]!.sql).toContain('assets');
  });
  it('keeps theme update unconditional when database eligibility is false', async () => {
    const { repo, batch } = setup();
    batch.mockResolvedValue([
      {},
      {},
      {},
      [{ id: site.id }],
      {},
      {},
      {},
      {},
      { rows: [{ virgin: false }] },
    ]);
    expect(
      await repo.apply(site.id, user.id, buildTemplate('creative', 'en')),
    ).toMatchObject({ appliedTheme: true, contentSkipped: true });
    const queries = (batch.mock.calls[0]![0] as unknown[]).map(compile);
    expect(queries[3]!.sql).not.toContain('template_virgin');
  });
  it('uses a false eligibility predicate for style-only actions', async () => {
    const { repo, batch } = setup();
    batch.mockResolvedValue([
      {},
      {},
      {},
      [{ id: site.id }],
      {},
      {},
      {},
      {},
      { rows: [{ virgin: false }] },
    ]);
    await repo.apply(site.id, user.id, buildTemplate('minimal', 'en'), false);
    expect(compile(batch.mock.calls[0]![0][2]).params).toContain(false);
  });
  it('rejects a missing owner inside the database transaction', async () => {
    const { repo, batch } = setup();
    batch.mockResolvedValue([
      {},
      {},
      {},
      [],
      {},
      {},
      {},
      {},
      { rows: [{ virgin: false }] },
    ]);
    await expect(
      repo.apply(site.id, user.id, buildTemplate('blank', 'en')),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('merges partial JSON inside the locked update without overwriting other theme fields', async () => {
    const { repo, batch } = setup();
    const theme = { ...DEFAULT_THEME, headingFont: 'lora', accent: '#1E5AA8' };
    batch.mockResolvedValue([{}, [{ theme }]]);
    expect(await repo.patch(site.id, user.id, { accent: '#1E5AA8' })).toEqual(
      theme,
    );
    const queries = (batch.mock.calls[0]![0] as unknown[]).map(compile);
    expect(queries[0]!.sql).toContain('pg_advisory_xact_lock');
    expect(queries[1]!.sql).toContain('case when jsonb_typeof');
    expect(queries[1]!.params).toContain(JSON.stringify({ accent: '#1E5AA8' }));
    expect(queries[1]!.params).toContain(user.id);
  });
});
