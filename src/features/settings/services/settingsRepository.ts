// src/features/settings/services/settingsRepository.ts
import { getFirstAsync, runAsync } from '@src/db/sqlite';
import type { SettingsRow } from '@src/db/schema/settings.schema';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  themePreference: ThemePreference;
}

const SETTINGS_ID = 'default';

function mapRowToSettings(row: SettingsRow): Settings {
  return {
    themePreference: row.theme_preference,
  };
}

/**
 * Load settings from SQLite.
 * If no row exists yet, create a default one and return it.
 */
export async function loadSettings(): Promise<Settings> {
  const row = await getFirstAsync<SettingsRow>(
    `
    SELECT *
    FROM settings
    WHERE id = ?
    LIMIT 1;
  `,
    [SETTINGS_ID],
  );

  if (!row) {
    const now = new Date().toISOString();
    const defaultSettings: Settings = { themePreference: 'light' };

    await runAsync(
      `
      INSERT INTO settings (id, theme_preference, created_at, updated_at)
      VALUES (?, ?, ?, ?);
    `,
      [SETTINGS_ID, defaultSettings.themePreference, now, now],
    );

    return defaultSettings;
  }

  return mapRowToSettings(row);
}

/**
 * Persist settings to SQLite.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const existing = await getFirstAsync<SettingsRow>(
    `
    SELECT *
    FROM settings
    WHERE id = ?
    LIMIT 1;
  `,
    [SETTINGS_ID],
  );

  const now = new Date().toISOString();

  if (!existing) {
    await runAsync(
      `
      INSERT INTO settings (id, theme_preference, created_at, updated_at)
      VALUES (?, ?, ?, ?);
    `,
      [SETTINGS_ID, settings.themePreference, now, now],
    );
  } else {
    await runAsync(
      `
      UPDATE settings
      SET theme_preference = ?, updated_at = ?
      WHERE id = ?;
    `,
      [settings.themePreference, now, SETTINGS_ID],
    );
  }
}
