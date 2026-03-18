// src/app/theme/index.ts
// §11 — Public API for the theme layer.
// useAppTheme() is the single point of token consumption for all UI components.
// useThemeContext() is for components that need to read or change the active theme.

export type { AppTheme } from './tokens';
export { makeTokens } from './tokens';
export type { ThemeName, ColorMode, ThemeContextValue } from './AppThemeProvider';
export { useThemeContext } from './AppThemeProvider';

import { useMemo } from 'react';
import { useTheme } from 'react-native-paper';
import { makeTokens } from './tokens';
import type { AppTheme } from './tokens';

export function useAppTheme(): AppTheme {
  const paperTheme = useTheme();
  return useMemo(() => makeTokens(paperTheme), [paperTheme]);
}
