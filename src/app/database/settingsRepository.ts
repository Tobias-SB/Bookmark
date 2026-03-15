// src/app/database/settingsRepository.ts
// App-level key-value settings persistence.
// NOTE: This establishes the settings repository pattern in src/app/database/.
// Settings are an app-wide concern, not a feature — they live in the app layer.

import type { SQLiteDatabase } from 'expo-sqlite';

export const SETTINGS_KEYS = {
  theme: 'theme',
} as const;

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
