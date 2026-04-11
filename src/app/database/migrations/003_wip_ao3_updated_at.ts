// src/app/database/migrations/003_wip_ao3_updated_at.ts
// Adds ao3UpdatedAt before/after snapshot columns to wip_updates.
// Both nullable TEXT — existing rows receive NULL defaults (safe for ALTER TABLE ADD COLUMN).

export const migration003 = {
  version: 3,
  sql: `
    ALTER TABLE wip_updates ADD COLUMN previous_ao3_updated_at TEXT;
    ALTER TABLE wip_updates ADD COLUMN fetched_ao3_updated_at TEXT;
  `,
};
