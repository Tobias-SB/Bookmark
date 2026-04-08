// src/features/shelves/data/shelfRepository.ts
// Repository functions for the shelves and shelf_readables tables.
// Plain async functions; no React hooks. Hooks obtain `db` via useDatabase()
// and pass it here.
//
// Immutability enforced here:
//   - id is generated via Crypto.randomUUID() in createShelf.
//   - dateCreated / dateAdded are set once at creation; never overwritten.
//   - dateUpdated is always new Date().toISOString() on every write.
//   - ON DELETE CASCADE in the schema cleans shelf_readables automatically
//     when a shelf or readable is deleted — no manual join table cleanup needed.

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { isAppError } from '../../../shared/types/errors';
import type { Shelf, ShelfReadable } from '../domain/shelf';
import { rowToShelf, rowToShelfReadable, type ShelfRow, type ShelfReadableRow } from './shelfMapper';

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateShelfInput {
  name: string;
}

export interface UpdateShelfInput {
  name?: string;
  sortOrder?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function localMidnightUTC(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

function toDbError(cause: unknown, context: string) {
  return {
    code: 'db' as const,
    message: `${context}: ${cause instanceof Error ? cause.message : String(cause)}`,
  };
}

// ── listShelves ───────────────────────────────────────────────────────────────

/** Returns all shelves ordered by sort_order ascending. */
export async function listShelves(db: SQLiteDatabase): Promise<Shelf[]> {
  try {
    const rows = await db.getAllAsync<ShelfRow>(
      'SELECT * FROM shelves ORDER BY sort_order ASC, date_created ASC',
    );
    return rows.map(rowToShelf);
  } catch (cause) {
    throw toDbError(cause, 'listShelves');
  }
}

// ── getShelfById ──────────────────────────────────────────────────────────────

/** Returns a single shelf by id, or null if not found. */
export async function getShelfById(
  db: SQLiteDatabase,
  id: string,
): Promise<Shelf | null> {
  try {
    const row = await db.getFirstAsync<ShelfRow>(
      'SELECT * FROM shelves WHERE id = ?',
      [id],
    );
    return row ? rowToShelf(row) : null;
  } catch (cause) {
    throw toDbError(cause, 'getShelfById');
  }
}

// ── createShelf ───────────────────────────────────────────────────────────────

/** Inserts a new shelf. Returns the created shelf. */
export async function createShelf(
  db: SQLiteDatabase,
  input: CreateShelfInput,
): Promise<Shelf> {
  try {
    const id = Crypto.randomUUID();
    const now = localMidnightUTC();
    await db.runAsync(
      `INSERT INTO shelves (id, name, sort_order, date_created, date_updated)
       VALUES (?, ?, 0, ?, ?)`,
      [id, input.name.trim(), now, now],
    );
    const created = await getShelfById(db, id);
    if (!created) throw new Error('Row missing after insert');
    return created;
  } catch (cause) {
    if (isAppError(cause)) throw cause;
    throw toDbError(cause, 'createShelf');
  }
}

// ── updateShelf ───────────────────────────────────────────────────────────────

/** Partially updates a shelf. Uses fetch-before-update pattern. */
export async function updateShelf(
  db: SQLiteDatabase,
  id: string,
  input: UpdateShelfInput,
): Promise<Shelf> {
  try {
    const existing = await getShelfById(db, id);
    if (!existing) {
      throw { code: 'not_found' as const, message: `Shelf not found: ${id}` };
    }
    const name = 'name' in input ? (input.name ?? existing.name).trim() : existing.name;
    const sortOrder = 'sortOrder' in input ? (input.sortOrder ?? existing.sortOrder) : existing.sortOrder;
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE shelves SET name = ?, sort_order = ?, date_updated = ? WHERE id = ?`,
      [name, sortOrder, now, id],
    );
    const updated = await getShelfById(db, id);
    if (!updated) throw new Error('Row missing after update');
    return updated;
  } catch (cause) {
    if (isAppError(cause)) throw cause;
    throw toDbError(cause, 'updateShelf');
  }
}

// ── deleteShelf ───────────────────────────────────────────────────────────────

/** Deletes a shelf. ON DELETE CASCADE removes shelf_readables rows automatically. */
export async function deleteShelf(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  try {
    await db.runAsync('DELETE FROM shelves WHERE id = ?', [id]);
  } catch (cause) {
    throw toDbError(cause, 'deleteShelf');
  }
}

// ── listShelfReadables ────────────────────────────────────────────────────────

/** Returns all shelf membership records for a shelf, ordered by position. */
export async function listShelfReadables(
  db: SQLiteDatabase,
  shelfId: string,
): Promise<ShelfReadable[]> {
  try {
    const rows = await db.getAllAsync<ShelfReadableRow>(
      'SELECT * FROM shelf_readables WHERE shelf_id = ? ORDER BY position ASC',
      [shelfId],
    );
    return rows.map(rowToShelfReadable);
  } catch (cause) {
    throw toDbError(cause, 'listShelfReadables');
  }
}

// ── addToShelf ────────────────────────────────────────────────────────────────

/** Adds a readable to a shelf. Position = current max + 1. No-op if already a member. */
export async function addToShelf(
  db: SQLiteDatabase,
  shelfId: string,
  readableId: string,
): Promise<void> {
  try {
    const maxRow = await db.getFirstAsync<{ max_pos: number | null }>(
      'SELECT MAX(position) AS max_pos FROM shelf_readables WHERE shelf_id = ?',
      [shelfId],
    );
    const nextPos = (maxRow?.max_pos ?? -1) + 1;
    const now = localMidnightUTC();
    await db.runAsync(
      `INSERT OR IGNORE INTO shelf_readables (shelf_id, readable_id, position, date_added)
       VALUES (?, ?, ?, ?)`,
      [shelfId, readableId, nextPos, now],
    );
  } catch (cause) {
    throw toDbError(cause, 'addToShelf');
  }
}

// ── removeFromShelf ───────────────────────────────────────────────────────────

/** Removes a readable from a shelf. */
export async function removeFromShelf(
  db: SQLiteDatabase,
  shelfId: string,
  readableId: string,
): Promise<void> {
  try {
    await db.runAsync(
      'DELETE FROM shelf_readables WHERE shelf_id = ? AND readable_id = ?',
      [shelfId, readableId],
    );
  } catch (cause) {
    throw toDbError(cause, 'removeFromShelf');
  }
}

// ── reorderShelf ──────────────────────────────────────────────────────────────

/** Updates positions for all readable IDs in a shelf in a single transaction. */
export async function reorderShelf(
  db: SQLiteDatabase,
  shelfId: string,
  orderedIds: string[],
): Promise<void> {
  try {
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.runAsync(
          'UPDATE shelf_readables SET position = ? WHERE shelf_id = ? AND readable_id = ?',
          [i, shelfId, orderedIds[i]],
        );
      }
    });
  } catch (cause) {
    throw toDbError(cause, 'reorderShelf');
  }
}
