import { z } from 'zod';
import { body, route } from '../../../../../lib/api';
import { adminContext } from '../../../../../lib/admin-session';
import { hasSameOrigin } from '../../../../../lib/request-origin';
import { reportsRepository } from '../../../../../lib/runtime';
import { AccountError } from '../../../../../lib/account-service';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(async (request) => {
    await adminContext();
    if (!hasSameOrigin(request)) throw new AccountError('origin', 403);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      throw new AccountError('notFound', 404);
    const { status } = await body(
      request,
      z.object({ status: z.enum(['reviewed', 'actioned']) }).strict(),
    );
    if (!(await reportsRepository().update(id, status)))
      throw new AccountError('notFound', 404);
    return Response.json({ ok: true });
  })(request);
}
