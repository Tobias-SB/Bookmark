// src/app/database/migrations/002_settings.ts
// §12 — Adds a general-purpose key-value settings table.
// Used for persisting user preferences (e.g. theme name).
// Forward-only. Do not rewrite this migration once applied.

export const migration002 = {
  version: 2,
  sql: `
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
} as const;
