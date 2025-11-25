// src/db/schema/settings.schema.ts
export type ThemePreferenceRow = 'light' | 'dark' | 'system';

export interface SettingsRow {
  id: string;
  theme_preference: ThemePreferenceRow;
  created_at: string;
  updated_at: string;
}
