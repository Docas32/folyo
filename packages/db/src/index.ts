import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { databaseUrlSchema } from '@folyo/core';
import * as schema from './schema';
// HTTP has no persistent TCP pool in Workers; use Neon's pooled URL upstream.
export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrlSchema.parse(databaseUrl)), {
    schema
  });
}
export * from './schema';
export type Database = ReturnType<typeof createDb>;
