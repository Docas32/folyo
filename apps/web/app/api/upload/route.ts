import {
  imageMimeSchema,
  MAX_UPLOAD_BYTES,
  uploadMetadataSchema,
} from '@folyo/core';
import { apiAccount, route } from '../../../lib/api';
import { AccountError } from '../../../lib/account-service';
import { assetRepository, objectStorage } from '../../../lib/runtime';
import {
  logUploadError,
  uploadErrorResponse,
  type UploadStage,
} from '../../../lib/upload-log';
export const POST = route(async (request) => {
  let stage: UploadStage = 'authorization';
  let key: string | null = null;
  try {
    const { user } = await apiAccount(request, 'user');
    stage = 'validation';
    const form = await request.formData().catch(() => {
      throw new AccountError('invalid', 400);
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw new AccountError('invalid', 400);
    const mime = imageMimeSchema.safeParse(file.type);
    if (!mime.success) throw new AccountError('invalid', 415);
    if (file.size > MAX_UPLOAD_BYTES) throw new AccountError('invalid', 413);
    if (!file.size) throw new AccountError('invalid', 400);
    const metadata = uploadMetadataSchema.safeParse({
      width: form.get('width'),
      height: form.get('height'),
      alt: form.get('alt'),
    });
    if (!metadata.success) throw new AccountError('invalid', 400);
    const ext = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }[mime.data];
    key = `assets/${user.id}/${crypto.randomUUID()}.${ext}`;
    stage = 'storage-config';
    const storage = objectStorage();
    stage = 'file-read';
    const bytes = await file.arrayBuffer();
    stage = 'storage-put';
    await storage.putObject(key, bytes, mime.data);
    stage = 'asset-insert';
    let assetId: string;
    try {
      assetId = await assetRepository().insert({
        userId: user.id,
        r2Key: key,
        mime: mime.data,
        size: file.size,
        ...metadata.data,
      });
    } catch (error) {
      // Best effort compensation: a DB failure must not acknowledge the upload.
      await storage.deleteObject(key).catch((cleanupError: unknown) => {
        logUploadError(cleanupError, 'storage-cleanup', key, 503);
      });
      throw error;
    }
    console.info(
      '[upload] success',
      JSON.stringify({
        status: 201,
        key,
        assetId,
        mime: mime.data,
        size: file.size,
      }),
    );
    return Response.json(
      { url: `/api/assets/${key}`, assetId },
      { status: 201 },
    );
  } catch (error) {
    const mapped = uploadErrorResponse(error, stage);
    logUploadError(error, stage, key, mapped.status);
    throw mapped;
  }
});
