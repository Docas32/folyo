import { z } from 'zod';
import { AccountError } from './account-service';
import { accountContext } from './session';
export async function apiAccount(
  request: Request,
  stage: 'user' | 'terms' | 'site',
) {
  // Custom cookie-authenticated mutations need CSRF protection as well as auth.
  if (
    request.method !== 'GET' &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    throw new AccountError('origin', 403);
  const context = await accountContext();
  if (stage !== 'user' && !context.user.termsAcceptedAt)
    throw new AccountError('termsRequired', 403);
  if (stage === 'site' && !context.site)
    throw new AccountError('siteRequired', 409);
  return context;
}
class BodyValidationError extends AccountError {
  constructor(public issues: z.ZodIssue[]) {
    super('invalid', 400);
  }
}
export async function body<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const json: unknown = await request.json().catch(() => {
    throw new AccountError('invalid', 400);
  });
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new BodyValidationError(parsed.error.issues);
  return parsed.data;
}
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof BodyValidationError)
        return Response.json(
          {
            error: 'invalid',
            issues: error.issues.map((issue) => ({
              path: issue.path,
              code: issue.code,
            })),
          },
          { status: 400 },
        );
      if (error instanceof AccountError)
        return Response.json(
          {
            error: error.code,
            ...(error.nextAllowedAt
              ? { nextAllowedAt: error.nextAllowedAt }
              : {}),
          },
          { status: error.status },
        );
      // Do not expose Neon queries, tokens or credentials in API responses/logs.
      return Response.json({ error: 'unavailable' }, { status: 503 });
    }
  };
}
