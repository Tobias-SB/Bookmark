import { use } from 'react';

import type { Db } from './Db';
import { DbContext } from './DatabaseProvider';

export function useDb(): Db {
  const db = use(DbContext);
  if (!db) throw new Error('useDb() was called outside <DatabaseProvider>.');
  return db;
}
