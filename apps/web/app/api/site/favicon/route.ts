import { apiAccount, route } from '../../../../lib/api';
import { AccountError } from '../../../../lib/account-service';
import { faviconRepository, objectStorage } from '../../../../lib/runtime';
import { MAX_FAVICON_BYTES, validateFavicon } from '../../../../lib/favicon';
export const POST = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (!site || site.userId !== user.id) throw new AccountError('notFound', 404);
  const form = await request.formData().catch(() => {
    throw new AccountError('invalid', 400);
  });
  const file = form.get('file');
  if (!(file instanceof File)) throw new AccountError('invalid', 400);
  if (file.size > MAX_FAVICON_BYTES) throw new AccountError('invalid', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { ext, mime } = validateFavicon(bytes, file.type);
  const key = `assets/${user.id}/${crypto.randomUUID()}.${ext}`;
  const storage = objectStorage();
  await storage.putObject(key, bytes.buffer, mime);
  try {
    if (
      !(await faviconRepository().save(site.id, user.id, key, mime, file.size))
    )
      throw new AccountError('notFound', 404);
  } catch (error) {
    await storage
      .deleteObject(key)
      .catch(() => console.error('[favicon] cleanup failed'));
    throw error;
  }
  return Response.json(
    { url: `/api/assets/${key}`, faviconKey: key },
    { status: 201 },
  );
});
export const DELETE = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (
    !site ||
    site.userId !== user.id ||
    !(await faviconRepository().reset(site.id, user.id))
  )
    throw new AccountError('notFound', 404);
  return Response.json({ url: '/favicon.svg', faviconKey: null });
});
