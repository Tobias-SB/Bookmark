import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { capabilities } from '@/platform/capabilities';

import type { Db, SqlParams } from './Db';
import { guardDb } from './dbError';
import { withWriteQueue } from './writeQueue';

function connection(sqlite: SQLiteDatabase): Db {
  const db: Db = {
    run: async (sql, params) => ({ changes: (await sqlite.runAsync(sql, params ?? [])).changes }),
    all: <T>(sql: string, params?: SqlParams) => sqlite.getAllAsync<T>(sql, params ?? []),
    first: <T>(sql: string, params?: SqlParams) => sqlite.getFirstAsync<T>(sql, params ?? []),
    exec: (sql) => sqlite.execAsync(sql),
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      // expo-sqlite's transaction helpers resolve void, so the callback's value is carried out here.
      const results: T[] = [];
      if (capabilities.platform === 'web') {
        // Not exclusive on web; safe only because every write goes through the queue (spec §5.3).
        await sqlite.withTransactionAsync(async () => {
          results.push(await fn(db));
        });
      } else {
        await sqlite.withExclusiveTransactionAsync(async (txn) => {
          results.push(await fn(connection(txn)));
        });
      }
      return results[0];
    },
  };
  return db;
}

/** The `Db` port over expo-sqlite, for Android and web (spec §5.3). */
export function createExpoDb(name: string): Promise<Db> {
  return guardDb(async () => {
    const sqlite = await openDatabaseAsync(name);
    if (capabilities.platform !== 'web') {
      await sqlite.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    }
    return withWriteQueue(connection(sqlite));
  });
}
