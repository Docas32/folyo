import { z } from 'zod';
import { handleSchema } from '@folyo/core';
export const REPORT_REASONS = [
  'spam',
  'phishing',
  'illegal',
  'impersonation',
  'other',
] as const;
export const reportStatusSchema = z.enum(['open', 'reviewed', 'actioned']);
export const reportSchema = z
  .object({
    handle: handleSchema,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(2000).default(''),
    website: z.string().max(2000).default(''),
  })
  .strict();
export type Report = {
  id: string;
  handle: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: Date | null;
};
export interface ReportsRepository {
  submit(input: z.infer<typeof reportSchema>): Promise<void>;
  list(status?: z.infer<typeof reportStatusSchema>): Promise<Report[]>;
  update(id: string, status: 'reviewed' | 'actioned'): Promise<boolean>;
}
// Per-isolate MVP limiter; expired entries are pruned and the map is bounded.
export class ReportLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  allow(ip: string, now = Date.now()) {
    for (const [key, value] of this.entries)
      if (value.until <= now) this.entries.delete(key);
    let entry = this.entries.get(ip);
    if (!entry) {
      if (this.entries.size >= 10000) return false;
      entry = { count: 0, until: now + 60000 };
      this.entries.set(ip, entry);
    }
    return ++entry.count <= 5;
  }
}
export const reportLimiter = new ReportLimiter();
export function reportIp(request: { headers: Headers }) {
  return (
    request.headers.get('cf-connecting-ip') ??
    (process.env.ENVIRONMENT === 'dev'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : undefined) ??
    'unknown'
  );
}
