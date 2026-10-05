import { sql } from 'drizzle-orm';
import type { Database } from './index';

/** Append after a mutation in the same editor-locked batch (Neon HTTP transaction).
 * JSONPath traverses every content field, matching extractAssetKeys.
 * Published and in-flight snapshots keep their keys active.
 */
export function recomputeOrphansQuery(
  db: Database,
  owner: { userId: string } | { siteId: string },
) {
  const user =
    'userId' in owner
      ? sql`${owner.userId}::uuid`
      : sql`(select user_id from sites where id = ${owner.siteId}::uuid)`;
  return db.execute(sql`with referenced as (
    select distinct substring(value #>> '{}' from 13) as key
    from blocks b join pages p on p.id = b.page_id join sites s on s.id = p.site_id,
      lateral jsonb_path_query(b.content, '$.** ? (@.type() == "string")') as value
    where s.user_id = ${user} and left(value #>> '{}', 12) = '/api/assets/'
      and length(value #>> '{}') > 12
    union
    select s.favicon_key as key from sites s
    where s.user_id = ${user} and s.favicon_key is not null
    union
    select jsonb_array_elements_text(pub.assets_keys) as key
    from publications pub join sites s on s.id = pub.site_id
    where s.user_id = ${user} and s.status = 'published' and pub.version = s.published_version
    union
    select jsonb_array_elements_text(op.assets_keys) as key
    from publication_operations op join sites s on s.id = op.site_id
    where s.user_id = ${user}
  ) update assets a set orphaned_at = case
    when exists (select 1 from referenced r where r.key = a.r2_key) then null
    else coalesce(a.orphaned_at, now()) end
  where a.user_id = ${user}`);
}
export async function recomputeOrphans(userId: string, db: Database) {
  await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtextextended(
      'editor:' || (select id::text from sites where user_id = ${userId}::uuid), 0))`),
    recomputeOrphansQuery(db, { userId }),
  ]);
}

/** Defense in depth: GC rechecks protection even if an old orphan timestamp exists. */
export function publishedAssetProtection(key: import('drizzle-orm').SQL) {
  return sql`exists (
    select 1 from sites where favicon_key = ${key}
    union all
    select 1 from publications pub join sites s on s.id = pub.site_id
    where s.status = 'published' and pub.version = s.published_version
      and pub.assets_keys @> jsonb_build_array(${key})
    union all
    select 1 from publication_operations op
    where op.assets_keys @> jsonb_build_array(${key})
  )`;
}
