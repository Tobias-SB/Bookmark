import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Db } from '../../Db';
import { createTestDb } from '../../createTestDb';
import { SCHEMA } from '../001_initial';
import { migrations, runMigrations, type Migration } from '../index';

// Pre-release, 001 is edited in place to track the spec (§0); this fails when the two drift apart.
it('001 SQL matches spec §8.2 exactly', () => {
  const spec = readFileSync(join(__dirname, '../../../../docs/BOOKMARK_SPEC.md'), 'utf8').replace(/\r/g, '');
  const section = spec.slice(spec.indexOf('### 8.2 Schema'));
  const start = section.indexOf('```sql\n') + '```sql\n'.length;
  const sql = section.slice(start, section.indexOf('\n```', start));
  expect(SCHEMA.trim()).toBe(sql.trim());
});

const GENESIS_HLC = '000000000000000:00000:00000000-0000-0000-0000-000000000000';

const TABLES = [
  'ao3_check_state',
  'app_settings',
  'author_nudge_state',
  'cover_fetch_state',
  'covers',
  'id_aliases',
  'notes',
  'readables',
  'reading_events',
  'shelf_items',
  'shelves',
  'sync_log',
  'wip_updates',
];

const INDEXES = [
  'idx_events_at',
  'idx_events_readable',
  'idx_notes_readable',
  'idx_readables_isbn',
  'idx_readables_live',
  'idx_shelf_items_readable',
  'idx_shelf_items_shelf',
  'idx_wip_updates_inbox',
  'uq_readables_source',
];

const context = { randomUUID };

async function userVersion(db: Db) {
  return (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version;
}

async function names(db: Db, type: 'table' | 'index') {
  const rows = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
    [type],
  );
  return rows.map((r) => r.name);
}

async function migratedDb() {
  const db = createTestDb();
  await runMigrations(db, context);
  return db;
}

describe('runMigrations on a fresh database', () => {
  it('reaches user_version 1 with every table and index', async () => {
    const db = await migratedDb();
    expect(await userVersion(db)).toBe(1);
    expect(await names(db, 'table')).toEqual(TABLES);
    expect(await names(db, 'index')).toEqual(INDEXES);
  });

  it('seeds the Up Next shelf identically on every device', async () => {
    const db = await migratedDb();
    const shelf = await db.first<Record<string, unknown>>('SELECT * FROM shelves');
    expect(shelf).toEqual({
      id: 'shelf_up_next',
      name: 'Up Next',
      type: 'manual',
      system_key: 'up_next',
      filters_json: null,
      source_name: null,
      source_url: null,
      sort_key: 'a0',
      created_at: '1970-01-01T00:00:00.000Z',
      updated_at: '1970-01-01T00:00:00.000Z',
      field_clocks: expect.any(String),
      updated_hlc: GENESIS_HLC,
      deleted_at: null,
    });
    const clocks: unknown = JSON.parse(String(shelf?.field_clocks));
    expect(clocks).toEqual(
      Object.fromEntries(
        ['name', 'type', 'systemKey', 'filters', 'sourceName', 'sourceUrl', 'sortKey', 'createdAt', 'updatedAt'].map(
          (field) => [field, GENESIS_HLC],
        ),
      ),
    );
  });

  it('generates a UUID device_id and leaves hlc_last unseeded', async () => {
    const db = await migratedDb();
    const settings = await db.all<{ key: string; value: string }>('SELECT key, value FROM app_settings');
    expect(settings).toHaveLength(1);
    expect(settings[0].key).toBe('device_id');
    expect(settings[0].value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('runMigrations safety', () => {
  it('is a no-op when re-run', async () => {
    const db = await migratedDb();
    const before = await db.first<{ value: string }>("SELECT value FROM app_settings WHERE key = 'device_id'");
    await runMigrations(db, context);
    expect(await userVersion(db)).toBe(1);
    expect(await db.first("SELECT value FROM app_settings WHERE key = 'device_id'")).toEqual(before);
    expect(await db.first('SELECT count(*) AS n FROM shelves')).toEqual({ n: 1 });
  });

  it('rolls a failing migration back completely', async () => {
    const db = await migratedDb();
    const failing: Migration = {
      version: 2,
      up: async (tx) => {
        await tx.exec('CREATE TABLE half_done (x TEXT)');
        throw new Error('boom');
      },
    };
    await expect(runMigrations(db, context, [...migrations, failing])).rejects.toMatchObject({ code: 'db' });
    expect(await userVersion(db)).toBe(1);
    expect(await names(db, 'table')).toEqual(TABLES);
  });

  it('rolls back 001 itself, leaving a fresh database untouched', async () => {
    const db = createTestDb();
    const broken = () => {
      throw new Error('no uuid');
    };
    await expect(runMigrations(db, { randomUUID: broken })).rejects.toMatchObject({ code: 'db' });
    expect(await userVersion(db)).toBe(0);
    expect(await names(db, 'table')).toEqual([]);
  });

  it('refuses a database from a newer app version', async () => {
    const db = createTestDb();
    await db.exec('PRAGMA user_version = 99');
    await expect(runMigrations(db, context)).rejects.toMatchObject({ code: 'unsupported_version' });
  });
});

describe('001 CHECK constraints', () => {
  const now = '2026-10-28T00:00:00.000Z';
  const insertReadable = (db: Db, values: Record<string, string | number | null>) => {
    const row: Record<string, string | number | null> = {
      id: randomUUID(),
      title: 'T',
      source_type: 'manual',
      date_added: now,
      created_at: now,
      updated_at: now,
      updated_hlc: GENESIS_HLC,
      ...values,
    };
    const columns = Object.keys(row);
    return db.run(
      `INSERT INTO readables (${columns.join(', ')}) VALUES (${columns.map((c) => `$${c}`).join(', ')})`,
      Object.fromEntries(columns.map((c) => [`$${c}`, row[c]])),
    );
  };
  const book = { kind: 'book', progress_unit: 'pages' };
  const fanfic = { kind: 'fanfic', is_complete: 0, is_abandoned: 0 };

  it('accepts a valid book and fanfic', async () => {
    const db = await migratedDb();
    await expect(insertReadable(db, book)).resolves.toEqual({ changes: 1 });
    await expect(insertReadable(db, fanfic)).resolves.toEqual({ changes: 1 });
  });

  it('rejects a book with is_complete set', async () => {
    const db = await migratedDb();
    await expect(insertReadable(db, { ...book, is_complete: 1 })).rejects.toMatchObject({ code: 'db' });
  });

  it('rejects a fanfic missing is_complete', async () => {
    const db = await migratedDb();
    await expect(insertReadable(db, { kind: 'fanfic', is_abandoned: 0 })).rejects.toMatchObject({ code: 'db' });
  });

  it('rejects a smart shelf without filters', async () => {
    const db = await migratedDb();
    await expect(
      db.run(
        `INSERT INTO shelves (id, name, type, sort_key, created_at, updated_at, updated_hlc)
         VALUES ('s1', 'Smart', 'smart', 'a1', $now, $now, $hlc)`,
        { $now: now, $hlc: GENESIS_HLC },
      ),
    ).rejects.toMatchObject({ code: 'db' });
  });

  it('rejects a duplicate live source but allows a tombstoned duplicate', async () => {
    const db = await migratedDb();
    const ao3 = { ...fanfic, source_type: 'ao3', source_id: '12345' };
    await insertReadable(db, ao3);
    await expect(insertReadable(db, ao3)).rejects.toMatchObject({ code: 'db' });
    await expect(insertReadable(db, { ...ao3, deleted_at: now })).resolves.toEqual({ changes: 1 });
  });
});
