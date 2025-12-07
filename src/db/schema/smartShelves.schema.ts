// src/db/schema/smartShelves.schema.ts

/**
 * Row shape for the `smart_shelves` table.
 *
 * Suggested SQL (migration):
 *
 * CREATE TABLE IF NOT EXISTS smart_shelves (
 *   id TEXT PRIMARY KEY NOT NULL,
 *   name TEXT NOT NULL,
 *   filter_json TEXT NOT NULL,
 *   created_at TEXT NOT NULL,
 *   updated_at TEXT NOT NULL
 * );
 */
export interface SmartShelfRow {
  id: string;
  name: string;
  filter_json: string;
  created_at: string;
  updated_at: string;
}
