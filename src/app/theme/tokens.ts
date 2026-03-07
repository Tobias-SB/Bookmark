// src/app/theme/tokens.ts
// §11 — Semantic token layer. Derives app-level tokens from the Paper MD3 theme.
// UI components must consume AppTheme tokens exclusively — no raw Paper colors,
// no ad hoc theme objects, no hardcoded color values anywhere in the codebase.
// Only this file translates Paper values into app-level tokens.

import type { MD3Theme } from 'react-native-paper';

// ── Token shape ───────────────────────────────────────────────────────────────

export interface AppTheme {
  colors: {
    // Backgrounds
    background: string;
    surface: string;
    surfaceVariant: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textDisabled: string;
    textOnPrimary: string;

    // Brand / interactive
    primary: string;
    primaryContainer: string;
    onPrimaryContainer: string;

    // Destructive / error
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;

    // Borders
    outline: string;
    outlineVariant: string;

    // Inverse (for banners, snackbars)
    inverseSurface: string;
    inverseOnSurface: string;
  };
  dark: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────
// Called once per theme change by useAppTheme(). Not memoized here —
// the hook is responsible for memoisation if needed.

export function makeTokens(theme: MD3Theme): AppTheme {
  const c = theme.colors;
  return {
    colors: {
      background: c.background,
      surface: c.surface,
      surfaceVariant: c.surfaceVariant,

      textPrimary: c.onSurface,
      textSecondary: c.onSurfaceVariant,
      textDisabled: c.onSurfaceDisabled,
      textOnPrimary: c.onPrimary,

      primary: c.primary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,

      error: c.error,
      onError: c.onError,
      errorContainer: c.errorContainer,
      onErrorContainer: c.onErrorContainer,

      outline: c.outline,
      outlineVariant: c.outlineVariant,

      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseOnSurface,
    },
    dark: theme.dark,
  };
}
