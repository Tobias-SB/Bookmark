// src/db/sqlite.ts
import * as SQLite from 'expo-sqlite';

/**
 * Re-export some useful types so the rest of the app doesn't need to know expo-sqlite internals.
 */
export type SQLiteDatabase = SQLite.SQLiteDatabase;
export type SQLiteBindValue = SQLite.SQLiteBindValue;
export type SQLiteBindParams = SQLite.SQLiteBindParams;

// Expo doesn't provide a `SQLiteRow` type, so we define a reasonable one:
// each column name maps to a SQLiteBindValue.
export type SQLiteRow = Record<string, SQLiteBindValue>;

/**
 * Single shared DB instance (opened lazily).
 */
let dbPromise: Promise<SQLiteDatabase> | null = null;

const DB_NAME = 'bookmark.db';

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return dbPromise;
}

/**
 * Execute a SQL script that may contain multiple statements.
 * Useful for migrations or schema setup.
 */
export async function execAsync(sql: string): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(sql);
}

/**
 * Run a statement that doesn't return rows (INSERT/UPDATE/DELETE).
 */
export async function runAsync(
  sql: string,
  params?: SQLiteBindParams,
): Promise<SQLite.SQLiteRunResult> {
  const db = await getDatabase();
  if (params) {
    return db.runAsync(sql, params);
  }
  return db.runAsync(sql);
}

/**
 * Fetch multiple rows as typed results.
 *
 * Callers can pass a generic T (e.g. `getAllAsync<MyRow>(...)`).
 * By default we treat rows as a simple key/value map of column -> value.
 */
export async function getAllAsync<T = SQLiteRow>(
  sql: string,
  params?: SQLiteBindParams,
): Promise<T[]> {
  const db = await getDatabase();
  const rows = params ? await db.getAllAsync<T>(sql, params) : await db.getAllAsync<T>(sql);
  return rows as T[];
}

/**
 * Fetch a single row (or undefined if no row).
 */
export async function getFirstAsync<T = SQLiteRow>(
  sql: string,
  params?: SQLiteBindParams,
): Promise<T | undefined> {
  const db = await getDatabase();
  const row = params
    ? await db.getFirstAsync<T | null>(sql, params)
    : await db.getFirstAsync<T | null>(sql);

  // `getFirstAsync` returns `T | null`, we normalise `null` to `undefined`.
  return row ?? undefined;
}

/**
 * Expose direct DB access when absolutely necessary (rare).
 * Prefer using the helpers above in normal app code.
 */
export async function getRawDatabase(): Promise<SQLiteDatabase> {
  return getDatabase();
}
