// src/features/settings/services/settingsRepository.ts
import { getFirstAsync, runAsync } from '@src/db/sqlite';
import type { SettingsRow } from '@src/db/schema/settings.schema';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeVariant = 'default' | 'raspberryLemonade';

export interface Settings {
  themePreference: ThemePreference;
  themeVariant: ThemeVariant;
}

const SETTINGS_ID = 'default';

function mapRowToSettings(row: SettingsRow): Settings {
  return {
    themePreference: row.theme_preference,
    themeVariant: row.theme_variant ?? 'default',
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
    const defaultSettings: Settings = {
      themePreference: 'light',
      themeVariant: 'default',
    };

    await runAsync(
      `
      INSERT INTO settings (id, theme_preference, theme_variant, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?);
    `,
      [SETTINGS_ID, defaultSettings.themePreference, defaultSettings.themeVariant, now, now],
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
      INSERT INTO settings (id, theme_preference, theme_variant, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?);
    `,
      [SETTINGS_ID, settings.themePreference, settings.themeVariant, now, now],
    );
  } else {
    await runAsync(
      `
      UPDATE settings
      SET theme_preference = ?, theme_variant = ?, updated_at = ?
      WHERE id = ?;
    `,
      [settings.themePreference, settings.themeVariant, now, SETTINGS_ID],
    );
  }
}
