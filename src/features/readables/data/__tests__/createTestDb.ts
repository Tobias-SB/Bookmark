// src/features/readables/data/__tests__/createTestDb.ts
// Test helper: wraps better-sqlite3 in an async adapter compatible with the
// expo-sqlite v2 API surface used by the repository functions.
//
// The repository accepts `db: SQLiteDatabase` as a plain parameter — no React
// hooks are involved — so passing this adapter directly tests real SQL execution
// without any native module setup.
//
// NOTE: This establishes the first file in a __tests__ folder under data/.
// It is not a test file itself (no describe/it), so Jest will not collect it.

/* eslint-disable @typescript-eslint/no-explicit-any */
const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');

/**
 * Returns a lightweight async adapter around a better-sqlite3 in-memory database.
 * The returned object satisfies the expo-sqlite v2 method set used by the repository:
 * runAsync, getAllAsync, getFirstAsync, execAsync, withTransactionAsync.
 *
 * Cast the return value as `any` (or `unknown as SQLiteDatabase`) at the call site.
 */
export function createTestDb(schema: string) {
  const db = new BetterSqlite3(':memory:');
  db.exec(schema);

  return {
    async runAsync(sql: string, params: (string | number | null)[] = []) {
      db.prepare(sql).run(...(params as Parameters<ReturnType<typeof db.prepare>['run']>));
    },

    async getAllAsync<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
      return db.prepare(sql).all(
        ...(params as Parameters<ReturnType<typeof db.prepare>['all']>),
      ) as T[];
    },

    async getFirstAsync<T>(
      sql: string,
      params: (string | number | null)[] = [],
    ): Promise<T | null> {
      return (
        (db
          .prepare(sql)
          .get(...(params as Parameters<ReturnType<typeof db.prepare>['get']>)) as T | undefined) ??
        null
      );
    },

    async execAsync(sql: string) {
      db.exec(sql);
    },

    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
  };
}
