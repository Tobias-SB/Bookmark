// src/features/readables/data/readableRepository.ts
// §12 — Repository functions for the readables table. Plain async functions;
// no React hooks. Hooks obtain `db` via useDatabase() and pass it here.
//
// Immutability enforced here:
//   - progressUnit is always derived from kind — never accepted from input.
//   - sourceId is never overwritten by updateReadable.
//   - dateUpdated is always new Date().toISOString() on every write.
//   - id is generated via Crypto.randomUUID() in createReadable.
//   - isbn, coverUrl, and availableChapters are set at creation from import;
//     not overwritten by user edits.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isAppError, type AppError } from '../../../shared/types/errors';
import type {
  Readable,
  ReadableKind,
  ReadableStatus,
  ProgressUnit,
  SourceType,
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
  progressTotal?: number | null;
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
  /** Fanfic only: chapters published at import time. null for books and manual. */
  availableChapters?: number | null;
}

export interface UpdateReadableInput {
  title?: string;
  author?: string | null;
  status?: ReadableStatus;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  sourceUrl?: string | null;
  summary?: string | null;
  tags?: string[];
  isComplete?: boolean | null;
  /** ISO 8601. Supports backdating; no future dates enforced by repository. */
  dateAdded?: string;
  // Intentionally omitted — immutable after creation:
  //   kind, progressUnit, sourceType, sourceId, id, dateCreated,
  //   isbn, coverUrl, availableChapters
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

  try {
    await db.runAsync(
      `INSERT INTO readables (
        id, kind, title, author, status,
        progress_current, progress_total, progress_unit,
        source_type, source_url, source_id,
        summary, tags, is_complete,
        isbn, cover_url, available_chapters,
        date_added, date_created, date_updated
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )`,
      [
        id,
        input.kind,
        input.title,
        input.author ?? null,
        input.status ?? 'want_to_read',
        input.progressCurrent ?? null,
        input.progressTotal ?? null,
        progressUnit,
        input.sourceType,
        input.sourceUrl ?? null,
        input.sourceId ?? null,
        input.summary ?? null,
        JSON.stringify(input.tags ?? []),
        booleanToSQLite(input.isComplete ?? null),
        input.isbn ?? null,
        input.coverUrl ?? null,
        input.availableChapters ?? null,
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

  const title = input.title ?? existing.title;
  const author = 'author' in input ? (input.author ?? null) : existing.author;
  const status = input.status ?? existing.status;
  const progressCurrent =
    'progressCurrent' in input ? (input.progressCurrent ?? null) : existing.progressCurrent;
  const progressTotal =
    'progressTotal' in input ? (input.progressTotal ?? null) : existing.progressTotal;
  const sourceUrl =
    'sourceUrl' in input ? (input.sourceUrl ?? null) : existing.sourceUrl;
  const summary =
    'summary' in input ? (input.summary ?? null) : existing.summary;
  const tags = input.tags !== undefined ? input.tags : existing.tags;
  const isComplete =
    'isComplete' in input ? (input.isComplete ?? null) : existing.isComplete;
  const dateAdded = input.dateAdded ?? existing.dateAdded;

  // Preserve import-only fields — not user-editable.
  const isbn = existing.isbn;
  const coverUrl = existing.coverUrl;
  const availableChapters = existing.availableChapters;

  try {
    await db.runAsync(
      `UPDATE readables SET
        title = ?, author = ?, status = ?,
        progress_current = ?, progress_total = ?,
        source_url = ?, summary = ?, tags = ?,
        is_complete = ?, date_added = ?,
        isbn = ?, cover_url = ?, available_chapters = ?,
        date_updated = ?
      WHERE id = ?`,
      [
        title,
        author,
        status,
        progressCurrent,
        progressTotal,
        sourceUrl,
        summary,
        JSON.stringify(tags),
        booleanToSQLite(isComplete),
        dateAdded,
        isbn,
        coverUrl,
        availableChapters,
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

// ── deleteReadable ────────────────────────────────────────────────────────────

/** Hard-deletes a readable by id. Requires explicit confirmation in the UI before calling. */
export async function deleteReadable(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    await db.runAsync('DELETE FROM readables WHERE id = ?', [id]);
  } catch (cause) {
    throw toDbError(cause, 'deleteReadable');
  }
}
