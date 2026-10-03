import { RESERVED_HANDLES } from '@folyo/core';
import { createDb, reservedHandles } from './index';
import { databaseUrl } from './env';
await createDb(databaseUrl).insert(reservedHandles).values(RESERVED_HANDLES.map(handle => ({
  handle
}))).onConflictDoNothing();
