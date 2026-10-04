import { sql } from 'drizzle-orm';
import type { Database } from './index';

/** Append after a mutation in the same editor-locked batch (Neon HTTP transaction).
 * JSONPath traverses every content field, matching extractAssetKeys.
 * F4: exclude keys in the current publication snapshot before marking/collecting.
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
