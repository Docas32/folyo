import { z } from 'zod';
import { body, route } from '../../../lib/api';
import {
  reportIp,
  reportLimiter,
  reportSchema,
} from '../../../lib/report-service';
import { reportsRepository } from '../../../lib/runtime';
export const POST = route(async (request) => {
  const raw = await body(
    request,
    z.object({ website: z.string().optional() }).passthrough(),
  );
  if (raw.website) return Response.json({ ok: true });
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({ error: 'invalid' }, { status: 400 });
  if (!reportLimiter.allow(reportIp(request)))
    return Response.json(
      { error: 'rateLimited' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  await reportsRepository().submit(parsed.data);
  return Response.json({ ok: true });
});
