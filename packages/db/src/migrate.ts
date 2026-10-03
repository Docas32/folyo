import { migrate } from 'drizzle-orm/neon-http/migrator';
import { createDb } from './index';
import { databaseUrl } from './env';
await migrate(createDb(databaseUrl), {
  migrationsFolder: './migrations'
});
