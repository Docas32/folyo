import { z } from 'zod';
import { templateSchema, themePatchSchema } from '@folyo/core';
import { apiAccount, body, route } from './api';
import { templateRepository } from './runtime';
import { assertEditorOwner } from './editor-service';
import { AccountError } from './account-service';
import { buildTemplate } from './templates';
export const applyTemplate = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  assertEditorOwner(user.id, site);
  const { templateId, applyContent } = await body(
    request,
    z
      .object({
        templateId: templateSchema,
        applyContent: z.literal(false).optional(),
      })
      .strict(),
  );
  const result = await templateRepository().apply(
    site.id,
    user.id,
    buildTemplate(templateId, user.locale),
    ...(applyContent === false ? ([false] as const) : []),
  );
  return Response.json(result, { status: result.contentSkipped ? 409 : 200 });
});
export const patchTheme = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  assertEditorOwner(user.id, site);
  const patch = await body(request, themePatchSchema);
  return Response.json({
    theme: await templateRepository().patch(site.id, user.id, patch),
  });
});

// Explicit style action preserves content even when the site is still virgin.
export const applyTemplateStyle = route(async (request) => {
  const { user, site } = await apiAccount(request, 'site');
  if (!site) throw new AccountError('siteRequired', 409);
  assertEditorOwner(user.id, site);
  const { templateId } = await body(
    request,
    z.object({ templateId: templateSchema }).strict(),
  );
  const result = await templateRepository().apply(
    site.id,
    user.id,
    buildTemplate(templateId, user.locale),
    false,
  );
  return Response.json(result);
});
