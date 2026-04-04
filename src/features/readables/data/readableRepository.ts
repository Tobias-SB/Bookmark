// src/features/readables/data/readableRepository.ts
// Repository functions for the readables table. Plain async functions;
// no React hooks. Hooks obtain `db` via useDatabase() and pass it here.
//
// Immutability enforced here:
//   - progressUnit is always derived from kind — never accepted from input.
//   - sourceId is never overwritten by updateReadable.
//   - dateUpdated is always new Date().toISOString() on every write.
//   - id is generated via Crypto.randomUUID() in createReadable.
//   - isbn: set at creation from import; not overwritten by user edits.
//   - coverUrl: editable via UpdateReadableInput (set by useUpdateCover hook).
//   - authorType, publishedAt: import-only; not in UpdateReadableInput.
//   - ao3UpdatedAt: set by import and refreshReadableMetadata; not in UpdateReadableInput.
//   - notesUpdatedAt: repo-managed; not in UpdateReadableInput.
//
// Fanfic-only enforcement:
//   - fandom, relationships, rating, archiveWarnings, wordCount, availableChapters,
//     isAbandoned, publishedAt, ao3UpdatedAt, authorType are written as null/[]/false
//     for books regardless of input.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isAppError, type AppError } from '../../../shared/types/errors';
import type {
  Readable,
  ReadableKind,
  ReadableStatus,
  ProgressUnit,
  SourceType,
  AO3Rating,
  AuthorType,
} from '../domain/readable';
import {
  rowToReadable,
  booleanToSQLite,
  type ReadableRow,
} from './readableMapper';

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateReadableInput {
  kind: ReadableKind;
  title: string;
  author?: string | null;
  status?: ReadableStatus;
  progressCurrent?: number | null;
  totalUnits?: number | null;
  sourceType: SourceType;
  sourceUrl?: string | null;
  sourceId?: string | null;
  summary?: string | null;
  tags?: string[];
  isComplete?: boolean | null;
  /** ISO 8601. Defaults to today's date if not provided. */
  dateAdded?: string;
  /** ISBN-13 preferred, ISBN-10 fallback. null for manual/AO3. */
  isbn?: string | null;
  /** Remote cover image URL (HTTPS). null for manual/AO3. */
  coverUrl?: string | null;
  // Fanfic-only — enforced null/[]/false for books at write time:
  availableChapters?: number | null;
  wordCount?: number | null;
  fandom?: string[];
  relationships?: string[];
  rating?: AO3Rating | null;
  archiveWarnings?: string[];
  isAbandoned?: boolean;
  /** Import-only. Set on fanfic creation from AO3. */
  authorType?: AuthorType | null;
  /** Import-only. ISO 8601 date. Fanfic only. */
  publishedAt?: string | null;
  /** Set by import. ISO 8601 date. Fanfic only. */
  ao3UpdatedAt?: string | null;
  // Universal v2 fields:
  seriesName?: string | null;
  seriesPart?: number | null;
  seriesTotal?: number | null;
  notes?: string | null;
}

export interface UpdateReadableInput {
  title?: string;
  author?: string | null;
  status?: ReadableStatus;
  progressCurrent?: number | null;
  totalUnits?: number | null;
  sourceUrl?: string | null;
  summary?: string | null;
  tags?: string[];
  isComplete?: boolean | null;
  /** ISO 8601. Supports backdating; no future dates enforced by repository. */
  dateAdded?: string;
  notes?: string | null;
  seriesName?: string | null;
  seriesPart?: number | null;
  seriesTotal?: number | null;
  /** Remote or local cover image URL. Set to null to remove the cover. */
  coverUrl?: string | null;
  // Fanfic-only (enforced null/[]/false for books):
  availableChapters?: number | null;
  wordCount?: number | null;
  fandom?: string[];
  relationships?: string[];
  rating?: AO3Rating | null;
  archiveWarnings?: string[];
  isAbandoned?: boolean;
  ao3UpdatedAt?: string | null;
  // Intentionally omitted — these must not appear in UpdateReadableInput:
  //   kind, progressUnit, sourceType, sourceId, id, dateCreated,
  //   isbn, authorType, publishedAt, notesUpdatedAt
}

// ── Refresh input type ────────────────────────────────────────────────────────
// Used by refreshReadableMetadata. Only the fields listed in Appendix B "Updates" column.

export interface RefreshMetadataInput {
  availableChapters?: number | null;
  totalUnits?: number | null;
  wordCount?: number | null;
  isComplete?: boolean | null;
  ao3UpdatedAt?: string | null;
  tags?: string[];
  relationships?: string[];
  archiveWarnings?: string[];
  seriesTotal?: number | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function progressUnitFromKind(kind: ReadableKind): ProgressUnit {
  return kind === 'book' ? 'pages' : 'chapters';
}

function localMidnightUTC(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

function toDbError(cause: unknown, context: string): AppError {
  return {
    code: 'db',
    message: `${context}: ${cause instanceof Error ? cause.message : String(cause)}`,
  };
}

// ── listReadables ─────────────────────────────────────────────────────────────

/** Returns all readables. Filtering and sorting are applied in the hook layer. */
export async function listReadables(db: SQLiteDatabase): Promise<Readable[]> {
  try {
    const rows = await db.getAllAsync<ReadableRow>('SELECT * FROM readables');
    return rows.map(rowToReadable);
  } catch (cause) {
    throw toDbError(cause, 'listReadables');
  }
}

// ── getReadableById ───────────────────────────────────────────────────────────

/** Returns a single readable by its local id, or null if not found. */
export async function getReadableById(
  db: SQLiteDatabase,
  id: string,
): Promise<Readable | null> {
  try {
    const row = await db.getFirstAsync<ReadableRow>(
      'SELECT * FROM readables WHERE id = ?',
      [id],
    );
    return row ? rowToReadable(row) : null;
  } catch (cause) {
    throw toDbError(cause, 'getReadableById');
  }
}

// ── findReadableBySourceId ────────────────────────────────────────────────────

export async function findReadableBySourceId(
  db: SQLiteDatabase,
  sourceId: string,
  sourceType: SourceType,
): Promise<Readable | null> {
  try {
    const row = await db.getFirstAsync<ReadableRow>(
      'SELECT * FROM readables WHERE source_id = ? AND source_type = ?',
      [sourceId, sourceType],
    );
    return row ? rowToReadable(row) : null;
  } catch (cause) {
    throw toDbError(cause, 'findReadableBySourceId');
  }
}

// ── createReadable ────────────────────────────────────────────────────────────

/** Inserts a new readable and returns the created domain object. */
export async function createReadable(
  db: SQLiteDatabase,
  input: CreateReadableInput,
): Promise<Readable> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const dateAdded = input.dateAdded ?? localMidnightUTC();
  const progressUnit = progressUnitFromKind(input.kind);
  const isFanfic = input.kind === 'fanfic';

  // Enforce fanfic-only fields — books always get null/[]/false regardless of input.
  const availableChapters = isFanfic ? (input.availableChapters ?? null) : null;
  const wordCount = isFanfic ? (input.wordCount ?? null) : null;
  const fandom = isFanfic ? JSON.stringify(input.fandom ?? []) : '[]';
  const relationships = isFanfic ? JSON.stringify(input.relationships ?? []) : '[]';
  const rating = isFanfic ? (input.rating ?? null) : null;
  const archiveWarnings = isFanfic ? JSON.stringify(input.archiveWarnings ?? []) : '[]';
  const isAbandoned = isFanfic ? (input.isAbandoned === true ? 1 : 0) : 0;
  const authorType = isFanfic ? (input.authorType ?? null) : null;
  const publishedAt = isFanfic ? (input.publishedAt ?? null) : null;
  const ao3UpdatedAt = isFanfic ? (input.ao3UpdatedAt ?? null) : null;

  // notesUpdatedAt: set if notes provided on creation
  const notesUpdatedAt = input.notes != null ? now : null;

  try {
    await db.runAsync(
      `INSERT INTO readables (
        id, kind, title, author, status,
        progress_current, total_units, progress_unit,
        source_type, source_url, source_id,
        summary, tags, is_complete,
        isbn, cover_url,
        available_chapters, word_count,
        fandom, relationships, rating, archive_warnings,
        series_name, series_part, series_total,
        notes, notes_updated_at,
        published_at, ao3_updated_at,
        is_abandoned, author_type,
        date_added, date_created, date_updated
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?
      )`,
      [
        id,
        input.kind,
        input.title,
        input.author ?? null,
        input.status ?? 'want_to_read',
        input.progressCurrent ?? null,
        input.totalUnits ?? null,
        progressUnit,
        input.sourceType,
        input.sourceUrl ?? null,
        input.sourceId ?? null,
        input.summary ?? null,
        JSON.stringify(input.tags ?? []),
        booleanToSQLite(input.isComplete ?? null),
        input.isbn ?? null,
        input.coverUrl ?? null,
        availableChapters,
        wordCount,
        fandom,
        relationships,
        rating,
        archiveWarnings,
        input.seriesName ?? null,
        input.seriesPart ?? null,
        input.seriesTotal ?? null,
        input.notes ?? null,
        notesUpdatedAt,
        publishedAt,
        ao3UpdatedAt,
        isAbandoned,
        authorType,
        dateAdded,
        now,
        now,
      ],
    );

    const created = await getReadableById(db, id);
    if (!created) {
      throw new Error('Insert reported success but record not found on read-back.');
    }
    return created;
  } catch (cause) {
    if (isAppError(cause)) throw cause;
    throw toDbError(cause, 'createReadable');
  }
}

// ── updateReadable ────────────────────────────────────────────────────────────

export async function updateReadable(
  db: SQLiteDatabase,
  id: string,
  input: UpdateReadableInput,
): Promise<Readable> {
  const existing = await getReadableById(db, id);
  if (!existing) {
    const error: AppError = { code: 'not_found', message: `Readable '${id}' not found.` };
    throw error;
  }

  const dateUpdated = new Date().toISOString();
  const isFanfic = existing.kind === 'fanfic';

  const title = input.title ?? existing.title;
  const author = 'author' in input ? (input.author ?? null) : existing.author;
  const status = input.status ?? existing.status;
  const progressCurrent =
    'progressCurrent' in input ? (input.progressCurrent ?? null) : existing.progressCurrent;
  const totalUnits =
    'totalUnits' in input ? (input.totalUnits ?? null) : existing.totalUnits;
  const sourceUrl =
    'sourceUrl' in input ? (input.sourceUrl ?? null) : existing.sourceUrl;
  const summary =
    'summary' in input ? (input.summary ?? null) : existing.summary;
  const tags = input.tags !== undefined ? input.tags : existing.tags;
  const isComplete =
    'isComplete' in input ? (input.isComplete ?? null) : existing.isComplete;
  const dateAdded = input.dateAdded ?? existing.dateAdded;

  // notes + notesUpdatedAt: auto-set timestamp when notes change
  const notes = 'notes' in input ? (input.notes ?? null) : existing.notes;
  const notesUpdatedAt = 'notes' in input ? dateUpdated : existing.notesUpdatedAt;

  // Universal v2 fields
  const seriesName = 'seriesName' in input ? (input.seriesName ?? null) : existing.seriesName;
  const seriesPart = 'seriesPart' in input ? (input.seriesPart ?? null) : existing.seriesPart;
  const seriesTotal = 'seriesTotal' in input ? (input.seriesTotal ?? null) : existing.seriesTotal;

  // Preserve import-only fields (coverUrl is now user-editable via useUpdateCover)
  const isbn = existing.isbn;
  const coverUrl = 'coverUrl' in input ? (input.coverUrl ?? null) : existing.coverUrl;
  const authorType = existing.authorType;
  const publishedAt = existing.publishedAt;

  // Fanfic-only fields: enforce null/[]/false for books
  const availableChapters = isFanfic
    ? ('availableChapters' in input ? (input.availableChapters ?? null) : existing.availableChapters)
    : null;
  const wordCount = isFanfic
    ? ('wordCount' in input ? (input.wordCount ?? null) : existing.wordCount)
    : null;
  const fandom = isFanfic
    ? (input.fandom !== undefined ? input.fandom : existing.fandom)
    : [];
  const relationships = isFanfic
    ? (input.relationships !== undefined ? input.relationships : existing.relationships)
    : [];
  const rating = isFanfic
    ? ('rating' in input ? (input.rating ?? null) : existing.rating)
    : null;
  const archiveWarnings = isFanfic
    ? (input.archiveWarnings !== undefined ? input.archiveWarnings : existing.archiveWarnings)
    : [];
  const isAbandoned = isFanfic
    ? ('isAbandoned' in input ? (input.isAbandoned === true) : existing.isAbandoned)
    : false;
  const ao3UpdatedAt = isFanfic
    ? ('ao3UpdatedAt' in input ? (input.ao3UpdatedAt ?? null) : existing.ao3UpdatedAt)
    : null;

  try {
    await db.runAsync(
      `UPDATE readables SET
        title = ?, author = ?, status = ?,
        progress_current = ?, total_units = ?,
        source_url = ?, summary = ?, tags = ?,
        is_complete = ?, date_added = ?,
        isbn = ?, cover_url = ?,
        available_chapters = ?, word_count = ?,
        fandom = ?, relationships = ?, rating = ?, archive_warnings = ?,
        series_name = ?, series_part = ?, series_total = ?,
        notes = ?, notes_updated_at = ?,
        published_at = ?, ao3_updated_at = ?,
        is_abandoned = ?, author_type = ?,
        date_updated = ?
      WHERE id = ?`,
      [
        title,
        author,
        status,
        progressCurrent,
        totalUnits,
        sourceUrl,
        summary,
        JSON.stringify(tags),
        booleanToSQLite(isComplete),
        dateAdded,
        isbn,
        coverUrl,
        availableChapters,
        wordCount,
        JSON.stringify(fandom),
        JSON.stringify(relationships),
        rating,
        JSON.stringify(archiveWarnings),
        seriesName,
        seriesPart,
        seriesTotal,
        notes,
        notesUpdatedAt,
        publishedAt,
        ao3UpdatedAt,
        isAbandoned ? 1 : 0,
        authorType,
        dateUpdated,
        id,
      ],
    );

    const updated = await getReadableById(db, id);
    if (!updated) {
      throw new Error('Update reported success but record not found on read-back.');
    }
    return updated;
  } catch (cause) {
    if (isAppError(cause)) throw cause;
    throw toDbError(cause, 'updateReadable');
  }
}

// ── refreshReadableMetadata ───────────────────────────────────────────────────
// Updates only the fields in Appendix B "Updates" column. Does NOT touch:
// status, progressCurrent, notes, notesUpdatedAt, isAbandoned, dateAdded,
// author, title, summary, seriesName, seriesPart, fandom, rating, authorType,
// publishedAt, kind, sourceType, sourceId, dateCreated.
//
// Status reversion: if status === 'completed' AND new totalUnits > existing totalUnits,
// reverts status to 'reading' and returns { statusReverted: true }.

export async function refreshReadableMetadata(
  db: SQLiteDatabase,
  id: string,
  metadata: RefreshMetadataInput,
): Promise<{ statusReverted: boolean }> {
  const existing = await getReadableById(db, id);
  if (!existing) {
    const error: AppError = { code: 'not_found', message: `Readable '${id}' not found.` };
    throw error;
  }

  const dateUpdated = new Date().toISOString();

  const availableChapters =
    'availableChapters' in metadata ? (metadata.availableChapters ?? null) : existing.availableChapters;
  const totalUnits =
    'totalUnits' in metadata ? (metadata.totalUnits ?? null) : existing.totalUnits;
  const wordCount =
    'wordCount' in metadata ? (metadata.wordCount ?? null) : existing.wordCount;
  const isComplete =
    'isComplete' in metadata ? (metadata.isComplete ?? null) : existing.isComplete;
  const ao3UpdatedAt =
    'ao3UpdatedAt' in metadata ? (metadata.ao3UpdatedAt ?? null) : existing.ao3UpdatedAt;
  const tags =
    metadata.tags !== undefined ? metadata.tags : existing.tags;
  const relationships =
    metadata.relationships !== undefined ? metadata.relationships : existing.relationships;
  const archiveWarnings =
    metadata.archiveWarnings !== undefined ? metadata.archiveWarnings : existing.archiveWarnings;
  const seriesTotal =
    'seriesTotal' in metadata ? (metadata.seriesTotal ?? null) : existing.seriesTotal;

  try {
    await db.runAsync(
      `UPDATE readables SET
        available_chapters = ?,
        total_units = ?,
        word_count = ?,
        is_complete = ?,
        ao3_updated_at = ?,
        tags = ?,
        relationships = ?,
        archive_warnings = ?,
        series_total = ?,
        date_updated = ?
      WHERE id = ?`,
      [
        availableChapters,
        totalUnits,
        wordCount,
        booleanToSQLite(isComplete),
        ao3UpdatedAt,
        JSON.stringify(tags),
        JSON.stringify(relationships),
        JSON.stringify(archiveWarnings),
        seriesTotal,
        dateUpdated,
        id,
      ],
    );
  } catch (cause) {
    if (isAppError(cause)) throw cause;
    throw toDbError(cause, 'refreshReadableMetadata');
  }

  // Status reversion: completed → reading when new totalUnits > previous totalUnits
  const previousTotalUnits = existing.totalUnits;
  if (
    existing.status === 'completed' &&
    totalUnits !== null &&
    previousTotalUnits !== null &&
    totalUnits > previousTotalUnits
  ) {
    await updateReadable(db, id, { status: 'reading' });
    return { statusReverted: true };
  }

  return { statusReverted: false };
}

// ── deleteReadable ────────────────────────────────────────────────────────────

/** Hard-deletes a readable by id. Requires explicit confirmation in the UI before calling. */
export async function deleteReadable(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    await db.runAsync('DELETE FROM readables WHERE id = ?', [id]);
  } catch (cause) {
    throw toDbError(cause, 'deleteReadable');
  }
}
