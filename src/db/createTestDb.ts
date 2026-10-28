import Database from 'better-sqlite3';

import type { Db, SqlParams } from './Db';
import { withWriteQueue } from './writeQueue';

// Code binds named params the expo-sqlite way ({ $id }); better-sqlite3 wants bare names ({ id }).
function bind(params: SqlParams | undefined): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params;
  return [Object.fromEntries(Object.entries(params).map(([key, value]) => [key.replace(/^[$:@]/, ''), value]))];
}

/** The `Db` port over in-memory better-sqlite3, for repository and migration tests (spec §5.3). */
export function createTestDb(filename = ':memory:'): Db {
  const sqlite = new Database(filename);

  const connection: Db = {
    async run(sql, params) {
      return { changes: sqlite.prepare(sql).run(...bind(params)).changes };
    },
    async all<T>(sql: string, params?: SqlParams) {
      return sqlite.prepare<unknown[], T>(sql).all(...bind(params));
    },
    async first<T>(sql: string, params?: SqlParams) {
      return sqlite.prepare<unknown[], T>(sql).get(...bind(params)) ?? null;
    },
    async exec(sql) {
      sqlite.exec(sql);
    },
    async transaction(fn) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(connection);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        if (sqlite.inTransaction) sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return withWriteQueue(connection);
}
