// src/features/readables/data/readableRepository.ts
// §12 — Repository functions for the readables table. Plain async functions;
// no React hooks. Hooks obtain `db` via useDatabase() and pass it here.
//
// Immutability enforced here:
//   - progressUnit is always derived from kind — never accepted from input.
//   - sourceId is never overwritten by updateReadable.
//   - dateUpdated is always new Date().toISOString() on every write.
//   - id is generated via Crypto.randomUUID() in createReadable.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError } from '../../../shared/types/errors';
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
  //   kind, progressUnit, sourceType, sourceId, id, dateCreated
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function progressUnitFromKind(kind: ReadableKind): ProgressUnit {
  return kind === 'book' ? 'pages' : 'chapters';
}

/**
 * Returns midnight UTC of today's local calendar date as an ISO 8601 string.
 * Used as the default dateAdded so the stored date always matches the user's
 * local calendar day, regardless of timezone.
 *
 * e.g. a user in UTC+10 at 08:00 local → "2025-03-09T00:00:00.000Z"
 *      a user in UTC-5  at 23:00 local → "2025-03-08T00:00:00.000Z"
 *
 * This makes slice(0,10) on the stored value reliable for display and form
 * pre-fill without any UTC-to-local conversion on the read path.
 */
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

function isAppError(value: unknown): value is AppError {
  return (
    value !== null &&
    typeof value === 'object' &&
    'code' in value &&
    'message' in value
  );
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
        date_added, date_created, date_updated
      ) VALUES (
        ?, ?, ?, ?, ?,
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
        dateAdded,
        now, // dateCreated
        now, // dateUpdated
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

/**
 * Updates an existing readable and returns the updated domain object.
 *
 * Fetches the existing record first so we can merge only the provided fields
 * while writing all columns — this avoids dynamic SQL and keeps the update
 * path predictable. progressUnit and sourceId are never touched here.
 */
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

  // For optional nullable fields, 'key' in input distinguishes "not provided"
  // (undefined) from "explicitly set to null". For required non-null fields,
  // undefined means "keep existing".
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

  try {
    await db.runAsync(
      `UPDATE readables SET
        title = ?, author = ?, status = ?,
        progress_current = ?, progress_total = ?,
        source_url = ?, summary = ?, tags = ?,
        is_complete = ?, date_added = ?, date_updated = ?
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
