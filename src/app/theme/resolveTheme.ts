export type ThemeName = 'light' | 'dark' | 'black';
export type ThemePreference = 'system' | ThemeName;

export function resolveTheme(preference: ThemePreference, systemScheme: 'light' | 'dark' | null | undefined): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
