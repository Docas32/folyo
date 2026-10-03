import { z } from 'zod';
import { handleSchema } from '@folyo/core';
export const onboardingSchema = z.object({ handle: handleSchema }).strict();
export const sitePatchSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(300).optional(),
    handle: handleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const termsSchema = z.object({ accepted: z.literal(true) }).strict();
export const deleteAccountSchema = z.object({ handle: handleSchema }).strict();
export const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().min(1),
  picture: z.string().url().optional(),
});
export const apiResponseSchema = z.object({
  available: z.boolean().optional(),
  reason: z.enum(['invalid', 'reserved', 'taken']).optional(),
  error: z
    .enum([
      'unauthorized',
      'termsRequired',
      'siteRequired',
      'invalid',
      'reserved',
      'taken',
      'cooldown',
      'confirmation',
      'conflict',
      'unavailable',
      'origin',
      'notFound',
    ])
    .optional(),
  nextAllowedAt: z.string().datetime().optional(),
  redirect: z.string().optional(),
});
