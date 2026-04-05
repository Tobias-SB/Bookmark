// src/app/theme/index.ts
// §11 — Public API for the theme layer.
// useAppTheme() is the single point of token consumption for all UI components.
// useThemeContext() is for components that need to read or change the active theme.

export type { AppTheme, AppColors, AppShadowOverrides, AppThemeOverrideSet } from './tokens';
export { makeTokens } from './tokens';
export type { ThemeName, ColorMode, ThemeContextValue } from './AppThemeProvider';
export { useThemeContext, APP_THEME_OVERRIDES } from './AppThemeProvider';

import { useMemo } from 'react';
import { useTheme } from 'react-native-paper';
import { makeTokens } from './tokens';
import type { AppTheme } from './tokens';
import { useThemeContext, APP_THEME_OVERRIDES } from './AppThemeProvider';

export function useAppTheme(): AppTheme {
  const paperTheme = useTheme();
  const { themeName } = useThemeContext();
  return useMemo(() => {
    const base = makeTokens(paperTheme);
    const overrides = APP_THEME_OVERRIDES[themeName];
    const { shadowCard, shadowSmall, shadowButton, ...colorOverrides } =
      paperTheme.dark ? overrides.dark : overrides.light;
    return {
      ...base,
      colors: { ...base.colors, ...colorOverrides },
      shadows: {
        card:   shadowCard   ?? base.shadows.card,
        small:  shadowSmall  ?? base.shadows.small,
        button: shadowButton ?? base.shadows.button,
      },
    };
  }, [paperTheme, themeName]);
}
