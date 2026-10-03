import { config } from 'dotenv';
import { databaseUrlSchema } from '@folyo/core';
config({
  path: '../../.env',
  quiet: true
});
export const databaseUrl = databaseUrlSchema.parse(process.env.DATABASE_URL);
