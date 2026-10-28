import { resolveTheme, type ThemeName, type ThemePreference } from '../resolveTheme';

describe('resolveTheme', () => {
  it.each<[ThemePreference, 'light' | 'dark' | null | undefined, ThemeName]>([
    ['system', 'light', 'light'],
    ['system', 'dark', 'dark'],
    ['system', null, 'light'],
    ['system', undefined, 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
    ['black', 'light', 'black'],
    ['black', 'dark', 'black'],
  ])('%s with system %s gives %s', (preference, systemScheme, expected) => {
    expect(resolveTheme(preference, systemScheme)).toBe(expected);
  });
});
