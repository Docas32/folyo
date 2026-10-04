import { collectDeletedPortfolios } from '../../../../lib/site-deletion-service';
import {
  siteDeletionBindings,
  siteDeletionRepository,
} from '../../../../lib/runtime';
import { createDb } from '@folyo/db';
import { collectAssets, gcRepository } from '../../../../lib/assets-gc';
import { objectStorage, serverEnv } from '../../../../lib/runtime';
export async function POST(request: Request) {
  return collectAssets(
    request,
    process.env.CRON_SECRET,
    process.env.GC_GRACE_DAYS,
    () => gcRepository(createDb(serverEnv().DATABASE_URL)),
    objectStorage,
    async () => {
      await collectDeletedPortfolios(
        siteDeletionRepository(),
        await siteDeletionBindings(),
      );
    },
  );
}
