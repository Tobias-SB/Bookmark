// src/features/shelves/data/shelfMapper.ts
// Maps between raw SQLite rows (snake_case) and the domain Shelf / ShelfReadable
// models (camelCase). Internal to the data layer — ShelfRow and ShelfReadableRow
// are not exported from the feature's index.ts.

import type { Shelf, ShelfReadable } from '../domain/shelf';

// ── Raw row shapes ────────────────────────────────────────────────────────────
// Mirror the SQLite column names exactly. Never used outside src/features/shelves/data/.

export interface ShelfRow {
  id: string;
  name: string;
  sort_order: number;
  date_created: string;
  date_updated: string;
}

export interface ShelfReadableRow {
  shelf_id: string;
  readable_id: string;
  position: number;
  date_added: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function rowToShelf(row: ShelfRow): Shelf {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}

export function rowToShelfReadable(row: ShelfReadableRow): ShelfReadable {
  return {
    shelfId: row.shelf_id,
    readableId: row.readable_id,
    position: row.position,
    dateAdded: row.date_added,
  };
}
