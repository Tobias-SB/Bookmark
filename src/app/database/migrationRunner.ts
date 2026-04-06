// src/app/database/migrationRunner.ts
// §12 — Applies pending migrations in version order using PRAGMA user_version.
// Each migration runs inside a transaction. user_version is set only after the
// transaction commits. If any migration throws, the runner surfaces an AppError —
// never silently skips or partially applies.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError } from '../../shared/types/errors';
import { migration001 } from './migrations/001_initial';
import { migration002 } from './migrations/002_settings';

interface Migration {
  version: number;
  sql: string;
}

// Add new migration objects here in ascending version order.
//
// IMPORTANT — all migration SQL must be idempotent (use CREATE TABLE IF NOT EXISTS,
// DROP INDEX IF EXISTS, etc.). SQLite does not allow PRAGMA user_version to be set
// inside a transaction, so the version stamp is written after the transaction commits.
// If the app crashes in that window, the migration re-runs on next launch. DDL that
// is not idempotent will fail or corrupt data on re-application.
const ALL_MIGRATIONS: Migration[] = [migration001, migration002];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  const pending = ALL_MIGRATIONS.filter((m) => m.version > currentVersion);

  for (const migration of pending) {
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.sql);
      });
      // Only reached if the transaction committed successfully.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    } catch (cause) {
      const error: AppError = {
        code: 'db',
        message: `Migration v${migration.version} failed: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      };
      throw error;
    }
  }
}
