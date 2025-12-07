// src/features/readables/types/smartShelves.ts
import type { SmartShelfRow } from '@src/db/schema/smartShelves.schema';
import { DEFAULT_LIBRARY_FILTER_STATE, type LibraryFilterState } from '../types/libraryFilters';

export type SmartShelfId = string;

/**
 * Domain model for a Smart Shelf.
 *
 * - `filter` is a full LibraryFilterState object that we serialize to JSON in the DB.
 */
export interface SmartShelf {
  id: SmartShelfId;
  name: string;
  filter: LibraryFilterState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmartShelfInput {
  name: string;
  filter: LibraryFilterState;
}

export interface UpdateSmartShelfInput {
  id: SmartShelfId;
  name?: string;
  filter?: LibraryFilterState;
}

/**
 * Mapper from DB row to domain model.
 *
 * We merge the stored filter JSON over DEFAULT_LIBRARY_FILTER_STATE so
 * adding new fields to LibraryFilterState won’t break existing shelves.
 */
export function mapSmartShelfRowToDomain(row: SmartShelfRow): SmartShelf {
  let parsedFilter: Partial<LibraryFilterState> = {};

  try {
    parsedFilter = JSON.parse(row.filter_json) as Partial<LibraryFilterState>;
  } catch {
    parsedFilter = {};
  }

  const filter: LibraryFilterState = {
    ...DEFAULT_LIBRARY_FILTER_STATE,
    ...parsedFilter,
  };

  return {
    id: row.id,
    name: row.name,
    filter,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build a SmartShelfRow ready for INSERT.
 */
export function buildSmartShelfInsertRow(
  input: CreateSmartShelfInput,
  id: SmartShelfId,
  nowIso: string,
): SmartShelfRow {
  const name = input.name.trim() || 'Untitled shelf';

  return {
    id,
    name,
    filter_json: JSON.stringify(input.filter),
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Build an updated SmartShelfRow given the existing row + a patch.
 */
export function buildSmartShelfUpdateRow(
  existing: SmartShelfRow,
  patch: UpdateSmartShelfInput,
  nowIso: string,
): SmartShelfRow {
  const nextName =
    typeof patch.name === 'string' ? patch.name.trim() || existing.name : existing.name;

  return {
    ...existing,
    name: nextName,
    filter_json: patch.filter != null ? JSON.stringify(patch.filter) : existing.filter_json,
    updated_at: nowIso,
  };
}
