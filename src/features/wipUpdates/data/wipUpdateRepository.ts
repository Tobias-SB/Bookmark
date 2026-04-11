// src/features/wipUpdates/data/wipUpdateRepository.ts
// Repository functions for the wip_updates table.
// Plain async functions; no React hooks.
// Hooks obtain `db` via useDatabase() and pass it here.
//
// Boolean helpers (boolFromSQLite / boolToSQLite) and parseArr are inlined
// here to avoid importing internals from another feature (readableMapper is
// internal to the readables data layer and not exported from readables/index.ts).

import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { WipUpdate, WipUpdateStatus, CreateWipUpdateInput } from '../domain/wipUpdate';

// ── Internal helpers ──────────────────────────────────────────────────────────

function boolFromSQLite(value: number | null): boolean | null {
  if (value === null) return null;
  return value !== 0;
}

function boolToSQLite(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

function parseArr(raw: string | null): string[] {
  try {
    return JSON.parse(raw ?? '[]') ?? [];
  } catch {
    return [];
  }
}

function toDbError(cause: unknown, context: string): Error {
  return new Error(
    `${context}: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
}

// ── Raw row shape ─────────────────────────────────────────────────────────────

interface WipUpdateRow {
  id: string;
  readable_id: string;
  readable_title: string;
  readable_author: string | null;
  checked_at: string;
  status: string;
  previous_available_chapters: number | null;
  fetched_available_chapters: number | null;
  previous_total_units: number | null;
  fetched_total_units: number | null;
  previous_word_count: number | null;
  fetched_word_count: number | null;
  previous_is_complete: number | null;
  fetched_is_complete: number | null;
  previous_tags: string;
  fetched_tags: string;
  previous_relationships: string;
  fetched_relationships: string;
  previous_archive_warnings: string;
  fetched_archive_warnings: string;
  previous_series_total: number | null;
  fetched_series_total: number | null;
  previous_ao3_updated_at: string | null;
  fetched_ao3_updated_at: string | null;
  status_reverted: number;
}

function rowToWipUpdate(row: WipUpdateRow): WipUpdate {
  return {
    id: row.id,
    readableId: row.readable_id,
    readableTitle: row.readable_title,
    readableAuthor: row.readable_author,
    checkedAt: row.checked_at,
    status: row.status as WipUpdateStatus,
    previousAvailableChapters: row.previous_available_chapters,
    fetchedAvailableChapters: row.fetched_available_chapters,
    previousTotalUnits: row.previous_total_units,
    fetchedTotalUnits: row.fetched_total_units,
    previousWordCount: row.previous_word_count,
    fetchedWordCount: row.fetched_word_count,
    previousIsComplete: boolFromSQLite(row.previous_is_complete),
    fetchedIsComplete: boolFromSQLite(row.fetched_is_complete),
    previousTags: parseArr(row.previous_tags),
    fetchedTags: parseArr(row.fetched_tags),
    previousRelationships: parseArr(row.previous_relationships),
    fetchedRelationships: parseArr(row.fetched_relationships),
    previousArchiveWarnings: parseArr(row.previous_archive_warnings),
    fetchedArchiveWarnings: parseArr(row.fetched_archive_warnings),
    previousSeriesTotal: row.previous_series_total,
    fetchedSeriesTotal: row.fetched_series_total,
    previousAo3UpdatedAt: row.previous_ao3_updated_at,
    fetchedAo3UpdatedAt: row.fetched_ao3_updated_at,
    statusReverted: row.status_reverted !== 0,
  };
}

// ── listWipUpdates ─────────────────────────────────────────────────────────────
// Unread records appear first, then sorted by checkedAt descending.

export async function listWipUpdates(db: SQLiteDatabase): Promise<WipUpdate[]> {
  try {
    const rows = await db.getAllAsync<WipUpdateRow>(
      `SELECT * FROM wip_updates ORDER BY (status = 'unread') DESC, checked_at DESC`,
    );
    return rows.map(rowToWipUpdate);
  } catch (cause) {
    throw toDbError(cause, 'listWipUpdates');
  }
}

// ── listUnreadWipUpdates ───────────────────────────────────────────────────────

export async function listUnreadWipUpdates(db: SQLiteDatabase): Promise<WipUpdate[]> {
  try {
    const rows = await db.getAllAsync<WipUpdateRow>(
      `SELECT * FROM wip_updates WHERE status = 'unread' ORDER BY checked_at DESC`,
    );
    return rows.map(rowToWipUpdate);
  } catch (cause) {
    throw toDbError(cause, 'listUnreadWipUpdates');
  }
}

// ── getWipUpdateById ──────────────────────────────────────────────────────────

export async function getWipUpdateById(
  db: SQLiteDatabase,
  id: string,
): Promise<WipUpdate | null> {
  try {
    const row = await db.getFirstAsync<WipUpdateRow>(
      'SELECT * FROM wip_updates WHERE id = ?',
      [id],
    );
    return row ? rowToWipUpdate(row) : null;
  } catch (cause) {
    throw toDbError(cause, 'getWipUpdateById');
  }
}

// ── createWipUpdate ───────────────────────────────────────────────────────────

export async function createWipUpdate(
  db: SQLiteDatabase,
  input: CreateWipUpdateInput,
): Promise<WipUpdate> {
  const id = Crypto.randomUUID();
  try {
    await db.runAsync(
      `INSERT INTO wip_updates (
        id, readable_id, readable_title, readable_author,
        checked_at, status,
        previous_available_chapters, fetched_available_chapters,
        previous_total_units, fetched_total_units,
        previous_word_count, fetched_word_count,
        previous_is_complete, fetched_is_complete,
        previous_tags, fetched_tags,
        previous_relationships, fetched_relationships,
        previous_archive_warnings, fetched_archive_warnings,
        previous_series_total, fetched_series_total,
        previous_ao3_updated_at, fetched_ao3_updated_at,
        status_reverted
      ) VALUES (
        ?, ?, ?, ?,
        ?, 'unread',
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?
      )`,
      [
        id,
        input.readableId,
        input.readableTitle,
        input.readableAuthor,
        input.checkedAt,
        input.previousAvailableChapters,
        input.fetchedAvailableChapters,
        input.previousTotalUnits,
        input.fetchedTotalUnits,
        input.previousWordCount,
        input.fetchedWordCount,
        boolToSQLite(input.previousIsComplete),
        boolToSQLite(input.fetchedIsComplete),
        JSON.stringify(input.previousTags),
        JSON.stringify(input.fetchedTags),
        JSON.stringify(input.previousRelationships),
        JSON.stringify(input.fetchedRelationships),
        JSON.stringify(input.previousArchiveWarnings),
        JSON.stringify(input.fetchedArchiveWarnings),
        input.previousSeriesTotal,
        input.fetchedSeriesTotal,
        input.previousAo3UpdatedAt,
        input.fetchedAo3UpdatedAt,
        input.statusReverted ? 1 : 0,
      ],
    );

    const created = await getWipUpdateById(db, id);
    if (!created) {
      throw new Error('Insert reported success but record not found on read-back.');
    }
    return created;
  } catch (cause) {
    throw toDbError(cause, 'createWipUpdate');
  }
}

// ── markWipUpdateRead ─────────────────────────────────────────────────────────

export async function markWipUpdateRead(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    await db.runAsync(`UPDATE wip_updates SET status = 'read' WHERE id = ?`, [id]);
  } catch (cause) {
    throw toDbError(cause, 'markWipUpdateRead');
  }
}

// ── markAllWipUpdatesRead ─────────────────────────────────────────────────────

export async function markAllWipUpdatesRead(db: SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync(`UPDATE wip_updates SET status = 'read' WHERE status = 'unread'`);
  } catch (cause) {
    throw toDbError(cause, 'markAllWipUpdatesRead');
  }
}

// ── deleteWipUpdate ───────────────────────────────────────────────────────────

export async function deleteWipUpdate(db: SQLiteDatabase, id: string): Promise<void> {
  try {
    await db.runAsync('DELETE FROM wip_updates WHERE id = ?', [id]);
  } catch (cause) {
    throw toDbError(cause, 'deleteWipUpdate');
  }
}

// ── deleteReadWipUpdates ──────────────────────────────────────────────────────

export async function deleteReadWipUpdates(db: SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync(`DELETE FROM wip_updates WHERE status = 'read'`);
  } catch (cause) {
    throw toDbError(cause, 'deleteReadWipUpdates');
  }
}

// ── deleteAllWipUpdates ───────────────────────────────────────────────────────

export async function deleteAllWipUpdates(db: SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync('DELETE FROM wip_updates');
  } catch (cause) {
    throw toDbError(cause, 'deleteAllWipUpdates');
  }
}
