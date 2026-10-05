import { and, eq, ne, or, isNull, lte } from 'drizzle-orm';
import {
  createDb,
  recomputeOrphansQuery,
  sites,
  users,
  reservedHandles,
} from '@folyo/db';
import { HANDLE_COOLDOWN_MS, type Repository } from './account-service';
export function createRepository(databaseUrl: string): Repository {
  const db = createDb(databaseUrl);
  return {
    async findUser(id) {
      return db.query.users.findFirst({ where: eq(users.id, id) });
    },
    async findSite(userId) {
      return db.query.sites.findFirst({ where: eq(sites.userId, userId) });
    },
    async isReserved(handle) {
      return Boolean(
        await db.query.reservedHandles.findFirst({
          where: eq(reservedHandles.handle, handle),
        }),
      );
    },
    async isTaken(handle, exceptSiteId) {
      return Boolean(
        await db.query.sites.findFirst({
          where: and(
            eq(sites.handle, handle),
            exceptSiteId ? ne(sites.id, exceptSiteId) : undefined,
          ),
        }),
      );
    },
    async createSite(userId, handle) {
      await db.insert(sites).values({
        userId,
        handle,
        templateId: 'blank',
        theme: { preset: 'blank' },
        status: 'draft',
      });
    },
    async acceptTerms(userId, version, now) {
      await db
        .update(users)
        .set({ termsAcceptedAt: now, termsVersion: version })
        .where(
          and(
            eq(users.id, userId),
            or(isNull(users.termsVersion), lte(users.termsVersion, version)),
          ),
        );
    },
    async updateSite(userId, siteId, patch, now) {
      const current = await db.query.sites.findFirst({
        where: and(eq(sites.userId, userId), eq(sites.id, siteId)),
      });
      if (!current) return false;
      const changesHandle =
        patch.handle !== undefined && patch.handle !== current.handle;
      const updated = await db
        .update(sites)
        .set({
          ...patch,
          updatedAt: now,
          ...(changesHandle ? { handleChangedAt: now } : {}),
        })
        .where(
          and(
            eq(sites.id, siteId),
            eq(sites.userId, userId),
            // Compare-and-set prevents two concurrent requests bypassing the cooldown.
            changesHandle
              ? and(
                  eq(sites.handle, current.handle),
                  or(
                    isNull(sites.handleChangedAt),
                    lte(
                      sites.handleChangedAt,
                      new Date(now.getTime() - HANDLE_COOLDOWN_MS),
                    ),
                  ),
                )
              : undefined,
          ),
        )
        .returning({ id: sites.id });
      return updated.length > 0;
    },
    async deleteUser(userId) {
      // Neon HTTP batch executes in a transaction; ON DELETE CASCADE covers all
      // tables related to this account, with no interactive socket.
      await db.batch([
        db.delete(users).where(eq(users.id, userId)),
        // Cascade removed all owned assets; keep the terminal GC hook explicit.
        recomputeOrphansQuery(db, { userId }),
      ]);
    },
  };
}
