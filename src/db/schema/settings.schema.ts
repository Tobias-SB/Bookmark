// src/db/schema/settings.schema.ts
export type ThemePreferenceRow = 'light' | 'dark' | 'system';
export type ThemeVariantRow = 'default' | 'raspberryLemonade';

export interface SettingsRow {
  id: string;
  theme_preference: ThemePreferenceRow;
  theme_variant: ThemeVariantRow;
  created_at: string;
  updated_at: string;
}
