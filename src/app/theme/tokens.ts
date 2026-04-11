// src/app/theme/tokens.ts
// §11 — Semantic token layer. Derives app-level tokens from the Paper MD3 theme.
// UI components must consume AppTheme tokens exclusively — no raw Paper colors,
// no ad hoc theme objects, no hardcoded color values anywhere in the codebase.
// Only this file translates Paper values into app-level tokens.
//
// Base palette: Scholar's Library (leather brown, royal blue, antiquarian gold).
// Future theme variants override specific tokens via APP_THEME_OVERRIDES in AppThemeProvider.

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
    /** Page / screen background. */
    backgroundPage: string;
    /** Floating card background. */
    backgroundCard: string;
    /** Input, chip, and secondary surface. */
    backgroundInput: string;
    /** Dividers and input borders. */
    backgroundBorder: string;

    // ── Text hierarchy (solid hex, contrast-verified) ────────────────────────────
    /** Body copy — author names, card body. */
    textBody: string;
    /** Section labels, timestamps, metadata. */
    textMeta: string;
    /**
     * Input placeholder text ONLY.
     * Exempt from 4.5:1 under WCAG 1.4.3. Never use for visible content.
     */
    textHint: string;

    // ── Kind accent ──────────────────────────────────────────────────────────────
    // Two independently themeable accent colours — the app's core personality tokens.
    kindBook: string;         // leather brown (light) / amber candlelight (dark)
    kindBookSubtle: string;   // chip/badge backgrounds
    kindBookBorder: string;   // chip/badge borders, focused input borders
    kindFanfic: string;       // royal blue (light) / moonlit sapphire (dark)
    kindFanficSubtle: string;
    kindFanficBorder: string;

    // ── Status semantic tokens ───────────────────────────────────────────────────
    // All four status families have dedicated tokens.
    statusWantText: string;      // warm gray (light) / muted warm (dark)
    statusWantBg: string;
    statusWantBorder: string;
    statusReadingText: string;   // library green
    statusReadingBg: string;
    statusReadingBorder: string;
    statusCompletedText: string; // antiquarian gold
    statusCompletedBg: string;
    statusCompletedBorder: string;
    statusDnfText: string;       // dusty mauve
    statusDnfBg: string;
    statusDnfBorder: string;

    // ── Danger / warning ─────────────────────────────────────────────────────────
    /** Delete buttons, archive warning chips, error states. */
    danger: string;
    /** Chip backgrounds, error snackbars. */
    dangerSubtle: string;
    /** Chip borders. */
    dangerBorder: string;

    // ── Overlay / absolute colors ─────────────────────────────────────────────────
    /** Semi-transparent backdrop behind modals and bottom sheets. */
    overlayBackground: string;
    /** Pure white — for text/icons rendered on filled colored backgrounds (buttons, FAB). */
    colorWhite: string;
    /** Subtle shadow strip on the left edge of cover thumbnails (book spine effect). */
    spineOverlay: string;

    // ── Decorative gradients ──────────────────────────────────────────────────────
    /** Tab bar gradient end stop. */
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
  /**
   * Shared UI dimension constants. Use these instead of per-screen magic
   * numbers so that layout details stay in sync across all screens.
   */
  metrics: {
    /** Height of all progress bar track + fill elements across the app. */
    progressBarHeight: number;
    /** Top corner radius for all bottom sheet modals (FilterModal, ShareHandlerScreen). */
    bottomSheetRadius: number;
  };
  /**
   * Named font-size scale. Use these instead of ad-hoc numeric values so
   * that all text sizes across the app remain aligned and easy to audit.
   *
   * Scale overview:
   *   badge    9   — notification badges, tiny metadata
   *   labelXs  11  — fandom tags, list pills, status chips
   *   labelSm  12  — section headers, auxiliary labels
   *   labelMd  13  — author names, meta rows, timestamps
   *   bodyMd   14  — body copy, form fields, buttons
   *   bodyLg   16  — readable body text (WCAG minimum for body)
   *   titleSm  17  — modal titles, card headings
   *   titleMd  20  — screen sub-headers
   *   titleLg  26  — primary screen title (Library, Detail hero)
   */
  typography: {
    badge: number;
    labelXs: number;
    labelSm: number;
    labelMd: number;
    bodyMd: number;
    bodyLg: number;
    titleSm: number;
    titleMd: number;
    titleLg: number;
  };
  dark: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────
// Base palette: Scholar's Library (leather brown, royal blue, antiquarian gold).
// Light mode = parchment and ink. Dark mode = aged oak and candlelight.
// Called once per theme change by useAppTheme(). Not memoized here —
// the hook is responsible for memoisation.

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

      // ── Surface palette — Scholar's Library ──────────────────────────────────
      backgroundPage:   isDark ? '#1A1410' : '#F8F4EE',
      backgroundCard:   isDark ? '#221C16' : '#FDFAF6',
      backgroundInput:  isDark ? '#2E2520' : '#F0EAE0',
      backgroundBorder: isDark ? '#4A3E34' : '#DDD4C5',

      // ── Text hierarchy — Scholar's Library ───────────────────────────────────
      textBody: isDark ? '#F0E8DC' : '#1A120A',
      textMeta: isDark ? '#C8B8A4' : '#4A3122',
      textHint: isDark ? '#8A7A6A' : '#6B4E33',

      // ── Kind accent — Scholar's Library ──────────────────────────────────────
      // Books → leather brown (light) / amber candlelight (dark)
      kindBook:         isDark ? '#E8924A' : '#7C3910',
      kindBookSubtle:   isDark ? '#2C1A0A' : '#FDF0E4',
      kindBookBorder:   isDark ? '#C06A28' : '#A35828',
      // Fanfic → royal blue (light) / moonlit sapphire (dark)
      kindFanfic:       isDark ? '#8AADEE' : '#1A3370',
      kindFanficSubtle: isDark ? '#0E1A2E' : '#E8F0FA',
      kindFanficBorder: isDark ? '#6B90D8' : '#4A72C4',

      // ── Status tokens — Scholar's Library ────────────────────────────────────
      // Want to read: warm neutral gray — inert, nothing happening yet
      statusWantText:   isDark ? '#C8C4BE' : '#3C3830',
      statusWantBg:     isDark ? '#2A2822' : '#EDEBE8',
      statusWantBorder: isDark ? '#5A5650' : '#AEAAA4',
      // Reading: library green — the banker's lamp, the act of reading
      statusReadingText:   isDark ? '#72C48A' : '#1A5530',
      statusReadingBg:     isDark ? '#0E2018' : '#E8F5EC',
      statusReadingBorder: isDark ? '#2A6040' : '#4A9B65',
      // Completed: antiquarian gold — achievement, gilded, precious
      statusCompletedText:   isDark ? '#E8B84A' : '#e7a03c',
      statusCompletedBg:     isDark ? '#221A06' : '#FEF6E0',
      statusCompletedBorder: isDark ? '#8A5C10' : '#C47830',
      // DNF: dusty mauve — gently set aside, not penalised
      statusDnfText:   isDark ? '#C090C8' : '#5A2E5E',
      statusDnfBg:     isDark ? '#1E1220' : '#F5EDF8',
      statusDnfBorder: isDark ? '#6A3E72' : '#B080BE',

      // ── Danger — Scholar's Library ────────────────────────────────────────────
      // Warm crimson (light) / deep rose-crimson (dark)
      danger:       isDark ? '#E86060' : '#9A1C1C',
      dangerSubtle: isDark ? '#2A1010' : '#FDF0F0',
      dangerBorder: isDark ? '#7A2828' : '#E09090',

      // ── Overlay / absolute colors ─────────────────────────────────────────────
      // overlayBackground: same neutral dark value in both modes — overlays are
      // always dark-on-content regardless of the app colour scheme.
      overlayBackground: 'rgba(0,0,0,0.45)',
      colorWhite: '#FFFFFF',
      // spineOverlay: black tint on light, white tint on dark (spine strip on thumbnails)
      spineOverlay: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',

      // ── Decorative gradients ──────────────────────────────────────────────────
      // Leather-brown tint (light) / amber tint (dark)
      tabBarGradientEnd: isDark ? 'rgba(232,146,74,0.12)' : 'rgba(124,57,16,0.12)',
    },
    shadows: isDark
      ? {
          // Dark mode: pure near-black with warmth bias, higher opacity
          card: {
            shadowColor:   '#0A0806',
            shadowOffset:  { width: 0, height: 3 },
            shadowOpacity: 0.40,
            shadowRadius:  10,
            elevation:     5,
          },
          small: {
            shadowColor:   '#0A0806',
            shadowOffset:  { width: 0, height: 1 },
            shadowOpacity: 0.30,
            shadowRadius:  5,
            elevation:     3,
          },
          button: {
            shadowColor:   '#0A0806',
            shadowOffset:  { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius:  4,
            elevation:     3,
          },
        }
      : {
          // Light mode: leather-brown tint, warm depth against parchment
          card: {
            shadowColor:   '#5C3010',
            shadowOffset:  { width: 0, height: 2 },
            shadowOpacity: 0.10,
            shadowRadius:  8,
            elevation:     3,
          },
          small: {
            shadowColor:   '#5C3010',
            shadowOffset:  { width: 0, height: 1 },
            shadowOpacity: 0.07,
            shadowRadius:  4,
            elevation:     2,
          },
          button: {
            shadowColor:   '#5C3010',
            shadowOffset:  { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius:  3,
            elevation:     2,
          },
        },
    radii: {
      card: 18,
      pill: 22,
      chip: 12,
    },
    metrics: {
      progressBarHeight: 4,
      bottomSheetRadius: 24,
    },
    typography: {
      badge:   9,
      labelXs: 11,
      labelSm: 12,
      labelMd: 13,
      bodyMd:  14,
      bodyLg:  16,
      titleSm: 17,
      titleMd: 20,
      titleLg: 26,
    },
    dark: theme.dark,
  };
}

// ── Override system types ─────────────────────────────────────────────────────
// Used by APP_THEME_OVERRIDES in AppThemeProvider to define per-theme token deltas.
// Future themes supply only the tokens that differ from the Scholar's Library base.

export type AppColors = AppTheme['colors'];

export type AppShadowOverrides = {
  shadowCard?: RNShadow;
  shadowSmall?: RNShadow;
  shadowButton?: RNShadow;
};

/** Flat override object: color deltas + optional shadow replacements. */
export type AppThemeOverrideSet = Partial<AppColors> & AppShadowOverrides;
