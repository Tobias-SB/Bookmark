// src/app/database/migrations/001_initial.ts
// Initial schema migration. All columns in snake_case.
// Forward-only. Do not rewrite this migration once it has been applied.
// Pre-release: all schema changes go here — no new migration files until the app ships.

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
      total_units      INTEGER,
      progress_unit    TEXT    NOT NULL,
      source_type      TEXT    NOT NULL,
      source_url       TEXT,
      source_id        TEXT,
      summary          TEXT,
      tags             TEXT    NOT NULL DEFAULT '[]',
      is_complete      INTEGER,
      isbn             TEXT,
      cover_url        TEXT,
      available_chapters INTEGER,
      word_count       INTEGER,
      fandom           TEXT    NOT NULL DEFAULT '[]',
      relationships    TEXT    NOT NULL DEFAULT '[]',
      rating           TEXT,
      archive_warnings TEXT    NOT NULL DEFAULT '[]',
      series_name      TEXT,
      series_part      INTEGER,
      series_total     INTEGER,
      notes            TEXT,
      notes_updated_at TEXT,
      published_at     TEXT,
      ao3_updated_at   TEXT,
      is_abandoned     INTEGER NOT NULL DEFAULT 0,
      author_type      TEXT,
      date_added       TEXT    NOT NULL,
      date_created     TEXT    NOT NULL,
      date_updated     TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wip_updates (
      id                          TEXT    PRIMARY KEY NOT NULL,
      readable_id                 TEXT    NOT NULL,
      readable_title              TEXT    NOT NULL,
      readable_author             TEXT,
      checked_at                  TEXT    NOT NULL,
      status                      TEXT    NOT NULL DEFAULT 'unread',
      previous_available_chapters INTEGER,
      fetched_available_chapters  INTEGER,
      previous_total_units        INTEGER,
      fetched_total_units         INTEGER,
      previous_word_count         INTEGER,
      fetched_word_count          INTEGER,
      previous_is_complete        INTEGER,
      fetched_is_complete         INTEGER,
      previous_tags               TEXT    NOT NULL DEFAULT '[]',
      fetched_tags                TEXT    NOT NULL DEFAULT '[]',
      previous_relationships      TEXT    NOT NULL DEFAULT '[]',
      fetched_relationships       TEXT    NOT NULL DEFAULT '[]',
      previous_archive_warnings   TEXT    NOT NULL DEFAULT '[]',
      fetched_archive_warnings    TEXT    NOT NULL DEFAULT '[]',
      previous_series_total       INTEGER,
      fetched_series_total        INTEGER,
      status_reverted             INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_wip_updates_readable_id ON wip_updates(readable_id);
    CREATE INDEX IF NOT EXISTS idx_wip_updates_status ON wip_updates(status);

    CREATE TABLE IF NOT EXISTS shelves (
      id           TEXT    PRIMARY KEY NOT NULL,
      name         TEXT    NOT NULL,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      date_created TEXT    NOT NULL,
      date_updated TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shelf_readables (
      shelf_id    TEXT    NOT NULL,
      readable_id TEXT    NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      date_added  TEXT    NOT NULL,
      PRIMARY KEY (shelf_id, readable_id),
      FOREIGN KEY (shelf_id)    REFERENCES shelves(id)   ON DELETE CASCADE,
      FOREIGN KEY (readable_id) REFERENCES readables(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shelf_readables_readable
      ON shelf_readables(readable_id);
  `,
} as const;
