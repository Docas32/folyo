import { createDb, recomputeOrphansQuery } from '@folyo/db';
import { sql } from 'drizzle-orm';
export function createFaviconRepository(databaseUrl: string) {
  const db = createDb(databaseUrl);
  const lock = (siteId: string) =>
    db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`editor:${siteId}`},0))`,
    );
  return {
    async save(
      siteId: string,
      userId: string,
      key: string,
      mime: string,
      size: number,
    ) {
      const [, result] = await db.batch([
        lock(siteId),
        db.execute(sql`with changed as (
        update sites set favicon_key=${key}, updated_at=clock_timestamp()
        where id=${siteId}::uuid and user_id=${userId}::uuid returning user_id
      ) insert into assets (user_id,r2_key,mime,size,alt)
        select user_id,${key},${mime},${size},'Favicon' from changed returning id`),
        recomputeOrphansQuery(db, { userId }),
      ]);
      return result.rows.length > 0;
    },
    async reset(siteId: string, userId: string) {
      const [, result] = await db.batch([
        lock(siteId),
        db.execute(
          sql`update sites set favicon_key=null, updated_at=clock_timestamp() where id=${siteId}::uuid and user_id=${userId}::uuid returning id`,
        ),
        recomputeOrphansQuery(db, { userId }),
      ]);
      return result.rows.length > 0;
    },
  };
}
