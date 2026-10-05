import { and, desc, eq, sql } from 'drizzle-orm';
import { createDb, reports, sites } from '@folyo/db';
import type { ReportsRepository } from './report-service';
export function createReportsRepository(
  databaseUrl: string,
): ReportsRepository {
  const db = createDb(databaseUrl);
  return {
    async submit(input) {
      // One statement: unknown handles return the same neutral response and a
      // concurrent site deletion cannot leave a foreign-key insert race.
      await db.execute(sql`insert into reports (site_id, reason, details, status)
        select id, ${input.reason}, ${input.details}, 'open' from sites where handle = ${input.handle}`);
    },
    async list(status) {
      return db
        .select({
          id: reports.id,
          handle: sites.handle,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .innerJoin(sites, eq(sites.id, reports.siteId))
        .where(status ? eq(reports.status, status) : undefined)
        .orderBy(desc(reports.createdAt))
        .limit(100);
    },
    async update(id, status) {
      const rows = await db
        .update(reports)
        .set({ status })
        .where(and(eq(reports.id, id)))
        .returning({ id: reports.id });
      return rows.length > 0;
    },
  };
}
