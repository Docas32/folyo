import {
  StorageConfigError,
  StorageRequestError,
  redactDiagnostic,
} from '@folyo/db/storage';
import { AccountError } from './account-service';
export type UploadStage =
  | 'authorization'
  | 'validation'
  | 'storage-config'
  | 'file-read'
  | 'storage-put'
  | 'asset-insert'
  | 'storage-cleanup';
export function uploadErrorResponse(error: unknown, stage: UploadStage) {
  if (error instanceof StorageConfigError)
    return new AccountError('storageConfig', 503);
  if (
    error instanceof StorageRequestError ||
    stage === 'storage-put' ||
    stage === 'storage-config'
  )
    return new AccountError('storageUnavailable', 503);
  if (error instanceof AccountError && error.status < 500) return error;
  return new AccountError(
    stage === 'asset-insert' ? 'uploadPersistenceFailed' : 'uploadFailed',
    500,
  );
}
export function logUploadError(
  error: unknown,
  stage: UploadStage,
  key: string | null,
  status: number,
) {
  const secrets = Object.entries(process.env)
    .filter(([name]) => /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL/i.test(name))
    .map(([, value]) => value ?? '');
  const details =
    error instanceof StorageConfigError
      ? { cause: error.message, fields: error.fields }
      : error instanceof StorageRequestError
        ? {
            cause: error.message,
            ...error.details,
            responseBody:
              error.details.responseBody === null
                ? null
                : redactDiagnostic(error.details.responseBody, secrets),
            ...(error.details.causeMessage
              ? {
                  causeMessage: redactDiagnostic(
                    error.details.causeMessage,
                    secrets,
                  ),
                }
              : {}),
          }
        : {
            cause:
              error instanceof Error
                ? redactDiagnostic(
                    error.cause instanceof Error
                      ? error.cause.message
                      : error.message,
                    secrets,
                  )
                : 'Unknown non-Error failure',
            causeCode: safeCode(error),
          };
  // One structured line, no raw Error objects/stacks, cookies, request body or headers.
  console.error(
    '[upload] failure',
    JSON.stringify({ stage, status, ...details, key }),
  );
}
function safeCode(error: unknown) {
  const outer = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = outer?.cause?.code ?? outer?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]+$/.test(code) ? code : null;
}
