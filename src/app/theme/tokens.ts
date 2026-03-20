// src/app/theme/tokens.ts
// §11 — Semantic token layer. Derives app-level tokens from the Paper MD3 theme.
// UI components must consume AppTheme tokens exclusively — no raw Paper colors,
// no ad hoc theme objects, no hardcoded color values anywhere in the codebase.
// Only this file translates Paper values into app-level tokens.

import type { MD3Theme } from 'react-native-paper';

// ── Shadow helper type ────────────────────────────────────────────────────────

export interface RNShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

// ── Token shape ───────────────────────────────────────────────────────────────

export interface AppTheme {
  colors: {
    // ── TIER 1: MD3-derived — kept for backwards compatibility ──────────────────
    // Migrate usages to the surface and text tokens below as each screen is rebuilt.
    // Do not use these in any new component code.

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

    // ── Surface palette ─────────────────────────────────────────────────────────
    /** Page / screen background. #F9F8F5 light, #121212 dark. */
    backgroundPage: string;
    /** Floating card background. #FFFFFF light, #1E1E1E dark. */
    backgroundCard: string;
    /** Input, chip, and secondary surface. #F1EDE7 light, #2A2A2A dark. */
    backgroundInput: string;
    /** Dividers and input borders. #E6DED4 light, #3A3A3A dark. */
    backgroundBorder: string;

    // ── Text hierarchy (solid hex, contrast-verified) ────────────────────────────
    // textPrimary from TIER 1 remains valid for headings and primary content.
    /** Secondary body copy — author names, card body. #4A3F35 light → 7.8:1 on white ✓ */
    textBody: string;
    /** Section labels, timestamps, metadata. #6B6058 light → 5.2:1 on white ✓ */
    textMeta: string;
    /**
     * Input placeholder text ONLY. #9A9088 light.
     * Exempt from 4.5:1 under WCAG 1.4.3. Never use for visible content.
     */
    textHint: string;

    // ── Kind accent ──────────────────────────────────────────────────────────────
    // Two independently themeable accent colours — the app's core personality tokens.
    // Each custom theme only needs to supply these six values.
    kindBook: string;         // default #6750A4 (MD3 primary)
    kindBookSubtle: string;   // default #EDE8F7 — chip/badge backgrounds
    kindBookBorder: string;   // default #C4B8E8 — chip/badge borders, focused input borders
    kindFanfic: string;       // default #00616E (nudged from #00696F for 4.6:1 safety margin)
    kindFanficSubtle: string; // default #E0F3F2
    kindFanficBorder: string; // default #9DD4D1

    // ── Status semantic tokens — reading and completed only ──────────────────────
    // DNF and Want to read use neutral surfaces that already exist in this token set:
    //   DNF:           backgroundColor:backgroundInput, color:textBody, borderColor:backgroundBorder
    //   Want to read:  backgroundColor:backgroundInput, color:textMeta, borderColor:backgroundBorder
    // No dedicated tokens are needed for those two states.
    statusReadingText: string;     // #6750A4 → 6.7:1 on statusReadingBg ✓
    statusReadingBg: string;       // #EDE8F7
    statusReadingBorder: string;   // #C4B8E8
    statusCompletedText: string;   // #1A6E3F → 4.7:1 on statusCompletedBg ✓
    statusCompletedBg: string;     // #E3F4EB
    statusCompletedBorder: string; // #A3D9B8

    // ── Danger / warning ─────────────────────────────────────────────────────────
    /** Delete buttons, archive warning chips, error states. #B91C1C → 5.4:1 on white ✓ */
    danger: string;
    /** Archive warning chip backgrounds, error snackbars. #FEF2F2 */
    dangerSubtle: string;
    /** Archive warning chip borders. #FECACA */
    dangerBorder: string;

    // ── Decorative gradients ──────────────────────────────────────────────────────
    /** Tab bar gradient end stop — subtle purple tint. rgba(103,80,164,0.13) light. */
    tabBarGradientEnd: string;
  };
  shadows: {
    card: RNShadow;
    small: RNShadow;
    button: RNShadow;
  };
  radii: {
    card: number;   // 18
    pill: number;   // 22
    chip: number;   // 12
  };
  dark: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────
// Called once per theme change by useAppTheme(). Not memoized here —
// the hook is responsible for memoisation if needed.

export function makeTokens(theme: MD3Theme): AppTheme {
  const c = theme.colors;
  const isDark = theme.dark;

  return {
    colors: {
      // TIER 1 — MD3-derived
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

      // Surface palette
      backgroundPage:   isDark ? '#121212' : '#F9F8F5',
      backgroundCard:   isDark ? '#1E1E1E' : '#FFFFFF',
      backgroundInput:  isDark ? '#2A2A2A' : '#F1EDE7',
      backgroundBorder: isDark ? '#3A3A3A' : '#E6DED4',

      // Text hierarchy
      textBody: isDark ? '#C4BBB2' : '#4A3F35',
      textMeta: isDark ? '#9A918A' : '#6B6058',
      textHint: isDark ? '#6A6360' : '#9A9088',

      // Kind accent
      kindBook:         isDark ? '#CFBCFF' : '#6750A4',
      kindBookSubtle:   isDark ? '#2A2340' : '#EDE8F7',
      kindBookBorder:   isDark ? '#6750A4' : '#C4B8E8',
      kindFanfic:       isDark ? '#4DD0E1' : '#00616E',
      kindFanficSubtle: isDark ? '#00363A' : '#E0F3F2',
      kindFanficBorder: isDark ? '#00616E' : '#9DD4D1',

      // Status tokens
      statusReadingText:     isDark ? '#CFBCFF' : '#6750A4',
      statusReadingBg:       isDark ? '#2A2340' : '#EDE8F7',
      statusReadingBorder:   isDark ? '#4A3D7A' : '#C4B8E8',
      statusCompletedText:   isDark ? '#6FCFA0' : '#1A6E3F',
      statusCompletedBg:     isDark ? '#0A2A1A' : '#E3F4EB',
      statusCompletedBorder: isDark ? '#1A5030' : '#A3D9B8',

      // Danger
      danger:       isDark ? '#F87171' : '#B91C1C',
      dangerSubtle: isDark ? '#2D0A0A' : '#FEF2F2',
      dangerBorder: isDark ? '#7F1D1D' : '#FECACA',

      // Decorative gradients
      tabBarGradientEnd: isDark ? 'rgba(207,188,255,0.12)' : 'rgba(103,80,164,0.13)',
    },
    shadows: {
      card: {
        shadowColor:   isDark ? '#000000' : '#1C140A',
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.30 : 0.08,
        shadowRadius:  8,
        elevation:     isDark ? 4 : 3,
      },
      small: {
        shadowColor:   isDark ? '#000000' : '#1C140A',
        shadowOffset:  { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.20 : 0.05,
        shadowRadius:  4,
        elevation:     isDark ? 2 : 1,
      },
      button: {
        shadowColor:   '#6750A4',
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.50 : 0.32,
        shadowRadius:  12,
        elevation:     8,
      },
    },
    radii: {
      card: 18,
      pill: 22,
      chip: 12,
    },
    dark: theme.dark,
  };
}

// ── Custom theme overrides ────────────────────────────────────────────────────
// Allows custom themes to supply only the kind accent and surface tokens.
// Pass to applyCustomOverrides() to produce a modified AppTheme.

export type CustomThemeOverrides = Partial<{
  kindBook: string;
  kindBookSubtle: string;
  kindBookBorder: string;
  kindFanfic: string;
  kindFanficSubtle: string;
  kindFanficBorder: string;
  backgroundPage: string;
  backgroundCard: string;
  backgroundInput: string;
  backgroundBorder: string;
}>;

export function applyCustomOverrides(
  base: AppTheme,
  overrides: CustomThemeOverrides,
): AppTheme {
  return { ...base, colors: { ...base.colors, ...overrides } };
}
