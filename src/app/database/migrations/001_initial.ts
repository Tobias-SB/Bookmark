// src/app/database/migrations/001_initial.ts
// §12 — Initial schema migration. All §3 columns in snake_case.
// Forward-only. Do not rewrite this migration once it has been applied.

export const migration001 = {
  version: 1,
  sql: `
    CREATE TABLE IF NOT EXISTS readables (
      id               TEXT    PRIMARY KEY NOT NULL,
      kind             TEXT    NOT NULL,
      title            TEXT    NOT NULL,
      author           TEXT,
      status           TEXT    NOT NULL DEFAULT 'want_to_read',
      progress_current INTEGER,
      progress_total   INTEGER,
      progress_unit    TEXT    NOT NULL,
      source_type      TEXT    NOT NULL,
      source_url       TEXT,
      source_id        TEXT,
      summary            TEXT,
      tags               TEXT    NOT NULL DEFAULT '[]',
      is_complete        INTEGER,
      isbn               TEXT,
      cover_url          TEXT,
      available_chapters INTEGER,
      date_added         TEXT    NOT NULL,
      date_created       TEXT    NOT NULL,
      date_updated       TEXT    NOT NULL
    );
  `,
} as const;
