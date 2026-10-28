import type { Db } from '../Db';
import type { MigrationContext } from './index';

// Spec §8.2, verbatim. Pre-release, schema changes edit this file in place (spec §0).
export const SCHEMA = `
-- ===== synced =====
CREATE TABLE readables (
  id                 TEXT PRIMARY KEY NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('book','fanfic')),
  title              TEXT NOT NULL,
  authors            TEXT NOT NULL DEFAULT '[]',
  status             TEXT NOT NULL DEFAULT 'want_to_read'
                     CHECK (status IN ('want_to_read','reading','completed','dnf')),
  progress_current   INTEGER CHECK (progress_current IS NULL OR progress_current >= 0),
  total_units        INTEGER CHECK (total_units IS NULL OR total_units >= 0),
  source_type        TEXT NOT NULL CHECK (source_type IN ('manual','ao3','google_books')),
  source_url         TEXT,
  source_id          TEXT,
  summary            TEXT,
  user_tags          TEXT NOT NULL DEFAULT '[]',
  is_favourite       INTEGER NOT NULL DEFAULT 0 CHECK (is_favourite IN (0,1)),
  series_key         TEXT,
  series_name        TEXT,
  series_part        INTEGER,
  series_total       INTEGER,
  started_at         TEXT,
  finished_at        TEXT,
  last_read_at       TEXT,
  read_count         INTEGER NOT NULL DEFAULT 0 CHECK (read_count >= 0),
  date_added         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  -- book-only
  progress_unit      TEXT CHECK (progress_unit IS NULL OR progress_unit IN ('pages','percent','minutes')),
  book_format        TEXT CHECK (book_format IS NULL OR book_format IN ('print','ebook','audio')),
  isbn13             TEXT,
  published_date     TEXT,
  is_owned           INTEGER CHECK (is_owned IS NULL OR is_owned IN (0,1)),
  -- fanfic-only
  is_complete        INTEGER CHECK (is_complete IS NULL OR is_complete IN (0,1)),
  is_abandoned       INTEGER CHECK (is_abandoned IS NULL OR is_abandoned IN (0,1)),
  available_chapters INTEGER CHECK (available_chapters IS NULL OR available_chapters >= 0),
  word_count         INTEGER CHECK (word_count IS NULL OR word_count > 0),
  fandoms            TEXT NOT NULL DEFAULT '[]',
  relationships      TEXT NOT NULL DEFAULT '[]',
  characters         TEXT NOT NULL DEFAULT '[]',
  categories         TEXT NOT NULL DEFAULT '[]',
  ao3_tags           TEXT NOT NULL DEFAULT '[]',
  rating             TEXT CHECK (rating IS NULL OR rating IN ('general','teen','mature','explicit','not_rated')),
  archive_warnings   TEXT NOT NULL DEFAULT '[]',
  author_type        TEXT CHECK (author_type IS NULL OR author_type IN ('known','anonymous','orphaned')),
  published_at       TEXT,
  ao3_updated_at     TEXT,
  -- sync
  field_clocks       TEXT NOT NULL DEFAULT '{}',
  updated_hlc        TEXT NOT NULL,
  deleted_at         TEXT,
  CHECK (kind = 'book'   OR (is_complete IS NOT NULL AND is_abandoned IS NOT NULL)),
  CHECK (kind = 'fanfic' OR (progress_unit IS NOT NULL AND is_complete IS NULL AND is_abandoned IS NULL
                             AND available_chapters IS NULL AND word_count IS NULL AND rating IS NULL
                             AND author_type IS NULL)),
  CHECK (kind = 'book'   OR (progress_unit IS NULL AND book_format IS NULL AND isbn13 IS NULL AND is_owned IS NULL))
);
CREATE UNIQUE INDEX uq_readables_source ON readables (source_type, source_id)
  WHERE source_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_readables_isbn ON readables (isbn13) WHERE isbn13 IS NOT NULL;
CREATE INDEX idx_readables_live ON readables (deleted_at);

CREATE TABLE notes (
  id            TEXT PRIMARY KEY NOT NULL,
  readable_id   TEXT NOT NULL,
  body          TEXT NOT NULL,
  position      INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_notes_readable ON notes (readable_id);

CREATE TABLE shelves (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('manual','smart')),
  system_key    TEXT CHECK (system_key IS NULL OR system_key IN ('up_next')),
  filters_json  TEXT,
  source_name   TEXT,
  source_url    TEXT,
  sort_key      TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT,
  CHECK ((type = 'smart') = (filters_json IS NOT NULL))
);

CREATE TABLE shelf_items (
  id            TEXT PRIMARY KEY NOT NULL,      -- \`\${shelf_id}:\${readable_id}\`
  shelf_id      TEXT NOT NULL,
  readable_id   TEXT NOT NULL,
  position      TEXT NOT NULL,
  added_at      TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_shelf_items_shelf ON shelf_items (shelf_id, position);
CREATE INDEX idx_shelf_items_readable ON shelf_items (readable_id);

CREATE TABLE reading_events (
  id              TEXT PRIMARY KEY NOT NULL,
  readable_id     TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('started','finished','dnf','reread_started')),
  at              TEXT NOT NULL,
  words_at_event  INTEGER,
  units_at_event  INTEGER,
  field_clocks    TEXT NOT NULL DEFAULT '{}',
  updated_hlc     TEXT NOT NULL,
  deleted_at      TEXT
);
CREATE INDEX idx_events_readable ON reading_events (readable_id, at);
CREATE INDEX idx_events_at ON reading_events (type, at);

CREATE TABLE id_aliases (
  alias_id      TEXT PRIMARY KEY NOT NULL,
  canonical_id  TEXT NOT NULL,
  created_hlc   TEXT NOT NULL
);

CREATE TABLE covers (
  readable_id   TEXT PRIMARY KEY NOT NULL,
  source        TEXT NOT NULL
                CHECK (source IN ('open_library','google_books','ao3_page','image_link','device')),
  is_fan_art    INTEGER NOT NULL DEFAULT 0 CHECK (is_fan_art IN (0,1)),
  credit_name   TEXT,
  credit_url    TEXT,
  origin_url    TEXT,
  mime          TEXT NOT NULL CHECK (mime IN ('image/jpeg')),
  width         INTEGER NOT NULL CHECK (width > 0),
  height        INTEGER NOT NULL CHECK (height > 0),
  thumb_data    BLOB NOT NULL,
  image_data    BLOB NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  field_clocks  TEXT NOT NULL DEFAULT '{}',
  updated_hlc   TEXT NOT NULL,
  deleted_at    TEXT
);

-- ===== device-local (never synced) =====
CREATE TABLE wip_updates (
  id                TEXT PRIMARY KEY NOT NULL,
  readable_id       TEXT NOT NULL,
  readable_title    TEXT NOT NULL,
  readable_authors  TEXT NOT NULL DEFAULT '[]',
  source            TEXT NOT NULL CHECK (source IN ('fetch','capture')),
  kind              TEXT NOT NULL CHECK (kind IN ('changed','not_found','restricted')),
  checked_at        TEXT NOT NULL,
  is_read           INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  changes_json      TEXT NOT NULL DEFAULT '[]',
  status_reverted   INTEGER NOT NULL DEFAULT 0 CHECK (status_reverted IN (0,1)),
  has_safety_change INTEGER NOT NULL DEFAULT 0 CHECK (has_safety_change IN (0,1))
);
CREATE INDEX idx_wip_updates_inbox ON wip_updates (is_read, checked_at);

CREATE TABLE ao3_check_state (
  readable_id      TEXT PRIMARY KEY NOT NULL,
  last_checked_at  TEXT NOT NULL,
  last_result      TEXT NOT NULL
                   CHECK (last_result IN ('unchanged','changed','not_found','restricted','failed'))
);

CREATE TABLE cover_fetch_state (
  readable_id    TEXT PRIMARY KEY NOT NULL,
  last_tried_at  TEXT NOT NULL,
  last_result    TEXT NOT NULL CHECK (last_result IN ('found','none','failed'))
);

CREATE TABLE author_nudge_state (
  readable_id         TEXT PRIMARY KEY NOT NULL,
  last_shown_at       TEXT NOT NULL,
  read_count_at_show  INTEGER NOT NULL,
  chapters_at_show    INTEGER
);

CREATE TABLE sync_log (
  id                 TEXT PRIMARY KEY NOT NULL,
  at                 TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('export','import')),
  peer_device_id     TEXT,
  peer_device_label  TEXT,
  summary_json       TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE app_settings (
  key    TEXT PRIMARY KEY NOT NULL,
  value  TEXT NOT NULL
);
`;

// Equals GENESIS_HLC (spec §9.2). Inlined because a migration must never change after release.
const GENESIS_HLC = '000000000000000:00000:00000000-0000-0000-0000-000000000000';
const EPOCH = '1970-01-01T00:00:00.000Z';

// Every Shelf domain field except id, which is the row key (spec §6.4, §9.4).
const SHELF_FIELDS = ['name', 'type', 'systemKey', 'filters', 'sourceName', 'sourceUrl', 'sortKey', 'createdAt', 'updatedAt'];

// The Up Next seed is identical on every device, so it never conflicts in sync (spec §7.7).
async function seedUpNext(tx: Db): Promise<void> {
  const fieldClocks = JSON.stringify(Object.fromEntries(SHELF_FIELDS.map((field) => [field, GENESIS_HLC])));
  await tx.run(
    `INSERT INTO shelves (id, name, type, system_key, sort_key, created_at, updated_at, field_clocks, updated_hlc)
     VALUES ('shelf_up_next', 'Up Next', 'manual', 'up_next', 'a0', $createdAt, $updatedAt, $fieldClocks, $updatedHlc)`,
    { $createdAt: EPOCH, $updatedAt: EPOCH, $fieldClocks: fieldClocks, $updatedHlc: GENESIS_HLC },
  );
}

export async function up(tx: Db, { randomUUID }: MigrationContext): Promise<void> {
  await tx.exec(SCHEMA);
  await seedUpNext(tx);
  await tx.run("INSERT INTO app_settings (key, value) VALUES ('device_id', ?)", [randomUUID()]);
}
