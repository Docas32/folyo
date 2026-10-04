import { assetKeySchema, imageMimeSchema } from '@folyo/core';
import { route } from '../../../../lib/api';
import { objectStorage } from '../../../../lib/runtime';
import { AccountError } from '../../../../lib/account-service';
export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  return route(async () => {
    const parsed = assetKeySchema.safeParse(
      (await context.params).key.join('/'),
    );
    if (!parsed.success) throw new AccountError('notFound', 404);
    const object = await objectStorage().getObject(parsed.data);
    if (!object) throw new AccountError('notFound', 404);
    const mime = imageMimeSchema.parse(object.headers.get('content-type'));
    return new Response(object.body, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  })(request);
}
