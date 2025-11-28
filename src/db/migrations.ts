// src/db/migrations.ts
import { execAsync, getAllAsync, runAsync } from './sqlite';

interface Migration {
  id: string;
  upSql: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: '001_initial_schema',
    upSql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS migrations_meta (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS readables (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        source TEXT,
        source_id TEXT,
        page_count INTEGER,
        ao3_work_id TEXT,
        ao3_url TEXT,
        fandoms_json TEXT,
        relationships_json TEXT,
        characters_json TEXT,
        ao3_tags_json TEXT,
        rating TEXT,
        warnings_json TEXT,
        chapter_count INTEGER,
        is_complete INTEGER,
        word_count INTEGER,
        genres_json TEXT,
        mood_tags_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS readable_mood_tags (
        id TEXT PRIMARY KEY,
        readable_id TEXT NOT NULL,
        mood_tag TEXT NOT NULL,
        FOREIGN KEY (readable_id) REFERENCES readables(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mood_profiles (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mood_profile_tags (
        id TEXT PRIMARY KEY,
        mood_profile_id TEXT NOT NULL,
        mood_tag TEXT NOT NULL,
        FOREIGN KEY (mood_profile_id) REFERENCES mood_profiles(id) ON DELETE CASCADE
      );
    `,
  },
  {
    id: '002_settings',
    upSql: `
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        theme_preference TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: '003_readables_progress_percent',
    upSql: `
      ALTER TABLE readables
      ADD COLUMN progress_percent INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: '004_settings_theme_variant',
    upSql: `
      ALTER TABLE settings
      ADD COLUMN theme_variant TEXT NOT NULL DEFAULT 'default';
    `,
  },
  {
    id: '005_readables_status_timestamps',
    upSql: `
      ALTER TABLE readables
      ADD COLUMN started_at TEXT;

      ALTER TABLE readables
      ADD COLUMN finished_at TEXT;

      ALTER TABLE readables
      ADD COLUMN dnf_at TEXT;

      -- Rough backfill based on current status.
      -- We use updated_at as a proxy for when that status was reached.
      UPDATE readables
      SET started_at = updated_at
      WHERE status = 'reading' AND started_at IS NULL;

      UPDATE readables
      SET finished_at = updated_at
      WHERE status = 'finished' AND finished_at IS NULL;

      UPDATE readables
      SET dnf_at = updated_at
      WHERE status = 'DNF' AND dnf_at IS NULL;
    `,
  },
  {
    id: '006_readables_notes',
    upSql: `
      ALTER TABLE readables
      ADD COLUMN notes TEXT;
    `,
  },
];

interface MigrationMetaRow {
  id: string;
  applied_at: string;
}

async function ensureMigrationsMetaTable(): Promise<void> {
  await execAsync(`
    CREATE TABLE IF NOT EXISTS migrations_meta (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

export async function getAppliedMigrationIds(): Promise<Set<string>> {
  await ensureMigrationsMetaTable();
  const rows = await getAllAsync<MigrationMetaRow>('SELECT id, applied_at FROM migrations_meta;');
  return new Set(rows.map((row) => row.id));
}

async function markMigrationApplied(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runAsync('INSERT INTO migrations_meta (id, applied_at) VALUES (?, ?);', [id, now]);
}

/**
 * Run any pending migrations in order.
 * This should be called once at app startup before using the DB.
 */
export async function runMigrations(): Promise<void> {
  await ensureMigrationsMetaTable();
  const appliedIds = await getAppliedMigrationIds();

  for (const migration of MIGRATIONS) {
    if (appliedIds.has(migration.id)) {
      // Already applied, skip
      continue;
    }

    await execAsync(migration.upSql);
    await markMigrationApplied(migration.id);
  }
}
