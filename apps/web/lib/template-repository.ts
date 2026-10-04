import { and, eq, sql } from 'drizzle-orm';
import {
  createDb,
  sites,
  recomputeOrphansQuery,
  type Database,
} from '@folyo/db';
import {
  DEFAULT_THEME,
  TEMPLATE_IDS,
  themeSchema,
  createDefaultBlock,
  getBlockPlaceholders,
  resolveTheme,
  type TemplateDefinition,
  type ThemePatch,
} from '@folyo/core';
import { AccountError } from './account-service';
// The same editor lock serializes bootstrap, autosave, page changes and templates.
export function templateRepositoryFromDb(db: Database) {
  const lock = (siteId: string) =>
    db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`}, 0))`,
    );
  const owner = (siteId: string, userId: string) =>
    and(eq(sites.id, siteId), eq(sites.userId, userId));
  return {
    async apply(
      siteId: string,
      userId: string,
      template: TemplateDefinition,
      content = true,
    ) {
      const defaults = ['pt-BR', 'en'].map((locale) => {
        const p = getBlockPlaceholders(locale);
        return sql`(p.title = ${p.pageTitle} and p.slug = ${p.pageSlug} and b.content = ${JSON.stringify(createDefaultBlock('hero', locale))}::jsonb)`;
      });
      // Eligibility is evaluated inside the transaction after acquiring both locks.
      // Transaction-local settings carry the decision across Neon HTTP statements.
      const virgin = sql`coalesce((select (${content} and
        coalesce(s.title, '') = '' and coalesce(s.description, '') = '' and coalesce(s.favicon_key, '') = '' and s.status <> 'published'
        and ((not exists (select 1 from pages where site_id = s.id)) or (
          (select count(*) from pages where site_id = s.id) = 1
          and (select count(*) from blocks b join pages p on p.id = b.page_id where p.site_id = s.id) = 1
          and exists (select 1 from pages p join blocks b on b.page_id = p.id where p.site_id = s.id and p.position = 0 and b.position = 0 and b.type = 'hero' and (${sql.join(defaults, sql` or `)}))
        ))) from sites s where s.id = ${siteId}::uuid and s.user_id = ${userId}::uuid), false)`;
      const firstPage = template.pages[0]!;
      // A repeated blank choice leaves existing page/block IDs intact.
      const alreadyBlank = sql`${template.theme.preset === 'blank'} and exists (
        select 1 from pages p join blocks b on b.page_id = p.id
        where p.site_id = ${siteId}::uuid and p.title = ${firstPage.title}
        and p.slug = ${firstPage.slug} and b.content = ${JSON.stringify(firstPage.blocks[0]!.content)}::jsonb
      )`;
      const eligible = sql`select
        set_config('folyo.template_virgin', virgin::text, true),
        set_config('folyo.template_replace', (virgin and not (${alreadyBlank}))::text, true)
        from (select ${virgin} as virgin) eligibility`;
      const incoming = template.pages.map((page, position) => ({
        ...page,
        id: crypto.randomUUID(),
        position,
      }));
      const [, , , updated, , , , , decision] = await db.batch([
        lock(siteId),
        db.execute(
          sql`select id from sites where id = ${siteId}::uuid and user_id = ${userId}::uuid for update`,
        ),
        db.execute(eligible),
        db
          .update(sites)
          .set({
            theme: template.theme,
            templateId: template.theme.preset,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(owner(siteId, userId))
          .returning({ id: sites.id }),
        db.execute(
          sql`delete from pages where site_id = ${siteId}::uuid and current_setting('folyo.template_replace') = 'true'`,
        ),
        db.execute(sql`insert into pages (id, site_id, title, slug, position)
          select (p->>'id')::uuid, ${siteId}::uuid, p->>'title', p->>'slug', (p->>'position')::int
          from jsonb_array_elements(${JSON.stringify(incoming)}::jsonb) p where current_setting('folyo.template_replace') = 'true'`),
        db.execute(sql`insert into blocks (id, page_id, type, content, position)
          select gen_random_uuid(), (p->>'id')::uuid, b->>'type', b->'content', ordinality - 1
          from jsonb_array_elements(${JSON.stringify(incoming)}::jsonb) p,
          lateral jsonb_array_elements(p->'blocks') with ordinality as item(b, ordinality)
          where current_setting('folyo.template_replace') = 'true'`),
        recomputeOrphansQuery(db, { siteId }),
        db.execute(
          sql`select current_setting('folyo.template_virgin') = 'true' as virgin`,
        ),
      ]);
      if (!updated.length) throw new AccountError('notFound', 404);
      return {
        appliedTheme: true as const,
        contentSkipped: decision.rows[0]?.virgin !== true,
        theme: template.theme,
      };
    },
    async patch(siteId: string, userId: string, patch: ThemePatch) {
      // Mirror resolveTheme's all-or-default fallback before merging a patch.
      const stored = sql`case when jsonb_typeof(${sites.theme}) = 'object' then
        case when (${sites.theme} - array['preset', 'accent', 'headingFont', 'bodyFont', 'heroLayout']) = '{}'::jsonb
          and (not (${sites.theme} ? 'preset') or ${sites.theme}->>'preset' in (${sql.join(
            TEMPLATE_IDS.map((value) => sql`${value}`),
            sql`, `,
          )}))
          and (not (${sites.theme} ? 'accent') or ${sites.theme}->>'accent' ~ '^#[0-9a-fA-F]{6}$')
          and (not (${sites.theme} ? 'headingFont') or ${sites.theme}->>'headingFont' in (${sql.join(
            themeSchema.shape.headingFont
              .removeDefault()
              .options.map((value) => sql`${value}`),
            sql`, `,
          )}))
          and (not (${sites.theme} ? 'bodyFont') or ${sites.theme}->>'bodyFont' in (${sql.join(
            themeSchema.shape.bodyFont
              .removeDefault()
              .options.map((value) => sql`${value}`),
            sql`, `,
          )}))
          and (not (${sites.theme} ? 'heroLayout') or ${sites.theme}->>'heroLayout' in (${sql.join(
            themeSchema.shape.heroLayout
              .removeDefault()
              .options.map((value) => sql`${value}`),
            sql`, `,
          )}))
          then ${sites.theme} else '{}'::jsonb end
        else '{}'::jsonb end`;
      const [, rows] = await db.batch([
        lock(siteId),
        db
          .update(sites)
          .set({
            theme: sql`${JSON.stringify(DEFAULT_THEME)}::jsonb || ${stored} || ${JSON.stringify(patch)}::jsonb`,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(owner(siteId, userId))
          .returning({ theme: sites.theme }),
      ]);
      if (!rows[0]) throw new AccountError('notFound', 404);
      return resolveTheme(rows[0].theme);
    },
  };
}
export function createTemplateRepository(databaseUrl: string) {
  return templateRepositoryFromDb(createDb(databaseUrl));
}
