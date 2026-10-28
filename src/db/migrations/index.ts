import { appError } from '@/shared/types/errors';

import type { Db } from '../Db';
import * as m001 from './001_initial';

export type MigrationContext = { randomUUID: () => string };
export type Migration = { version: number; up: (tx: Db, context: MigrationContext) => Promise<void> };

export const migrations: Migration[] = [{ version: 1, up: m001.up }];

/**
 * Brings the schema up to date (spec §8.5). Each migration runs in its own transaction and sets
 * `user_version` inside it, so a failure leaves the database exactly as it was.
 */
export async function runMigrations(db: Db, context: MigrationContext, list: Migration[] = migrations): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const latest = list.at(-1)?.version ?? 0;
  if (current > latest) {
    throw appError('unsupported_version', 'The database was written by a newer version of Bookmark');
  }
  for (const migration of list) {
    if (migration.version <= current) continue;
    await db.transaction(async (tx) => {
      await migration.up(tx, context);
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
