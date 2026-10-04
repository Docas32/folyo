import {
  createStorage,
  readStorageEnv,
  StorageConfigError,
  StorageRequestError,
} from './storage';
// Uses the same aws4fetch adapter as /api/upload. Run with dotenv from the repo root.
async function probe() {
  let stage = 'config';
  let uploaded = false;
  let storage: ReturnType<typeof createStorage> | undefined;
  const key = `assets/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
  try {
    storage = createStorage(readStorageEnv(process.env));
    const image = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
        'base64',
      ),
    );
    stage = 'put';
    await storage.putObject(key, image.buffer, 'image/png');
    uploaded = true;
    console.info(
      '[r2-probe] PUT OK',
      JSON.stringify({ bucket: 'folyo-assets', key }),
    );
    stage = 'get';
    const response = await storage.getObject(key);
    if (
      !response ||
      !Buffer.from(await response.arrayBuffer()).equals(Buffer.from(image))
    )
      throw new Error('Read-back mismatch');
    console.info('[r2-probe] GET OK');
  } catch (error) {
    console.error(
      '[r2-probe] failure',
      JSON.stringify({
        stage,
        ...(error instanceof StorageConfigError
          ? { cause: error.message, fields: error.fields }
          : error instanceof StorageRequestError
            ? { cause: error.message, ...error.details }
            : { cause: 'Read-back verification failed' }),
      }),
    );
    process.exitCode = 1;
  } finally {
    if (uploaded && storage) {
      try {
        await storage.deleteObject(key);
        console.info('[r2-probe] DELETE OK (temporary object removed)');
      } catch (error) {
        console.error(
          '[r2-probe] cleanup failure',
          JSON.stringify({
            ...(error instanceof StorageRequestError
              ? error.details
              : { cause: 'Cleanup failed', key }),
          }),
        );
        process.exitCode = 1;
      }
    }
  }
}
void probe();
