// src/theme/colors.ts

// Central colour definitions for Bookmark.
//
// - `default` is the main app theme (light + dark) built around the MD3
//   baseline with your original primary/secondary as anchors.
// - `raspberryLemonade` is the playful alternate palette.
// - `libraryShelves` is the warm, wood-themed "cozy library" palette.
// - Top-level `primary` / `secondary` are kept for backwards compatibility
//   and mirror the default light palette.

/**
 * Library Shelves – base palette (no chart colours).
 * Exposed in case we want to reuse these elsewhere.
 */
export const libraryShelvesPalette = {
  light: {
    primary: '#B8773C', // warm wood accent (polished oak)
    onPrimary: '#FFF8F0',
    primaryContainer: '#F0D5B8', // lighter wood highlight

    secondary: '#D3A66C', // lighter wood / brass
    onSecondary: '#301C0B',
    secondaryContainer: '#E2C79B', // softer brass / label

    background: '#F5F0E6', // paper / parchment
    onBackground: '#24160A',

    surface: '#EFE4D5', // desk / lighter page
    onSurface: '#24160A',

    surfaceVariant: '#D7C3A4', // shelf blocks / chips
    onSurfaceVariant: '#3B2613',

    outline: '#8A6A43',

    error: '#BA1A1A',
    onError: '#FFFFFF',
  },

  dark: {
    primary: '#E6B27A', // candlelit highlight on wood
    onPrimary: '#311707',
    primaryContainer: '#5A3415', // deep wood block

    secondary: '#CFA86A',
    onSecondary: '#221307',
    secondaryContainer: '#4D3518', // warm dark brass

    background: '#120E0A', // deep library at night
    onBackground: '#EADFCC',

    surface: '#1C1712', // table / card surface
    onSurface: '#F2E6D4',

    surfaceVariant: '#3B2A18', // shelf blocks / chips
    onSurfaceVariant: '#F0E0C8',

    outline: '#9D825A',

    error: '#FFB4AB',
    onError: '#410002',
  },
};

/**
 * Library Shelves – chart palette.
 * Used for stats pie charts & other categorical visuals in the wood theme.
 */
export const libraryChartColors: string[] = [
  '#8C3F2B', // brick leather
  '#C4633F', // terracotta
  '#E28B3D', // warm amber
  '#D4AF37', // brass / aged gold
  '#A5673F', // mid wood
  '#6B4B2F', // dark wood
  '#C97F62', // clay
  '#A89A7C', // parchment khaki

  '#4E6A39', // deep leaf
  '#689F63', // soft sage
  '#2F6F6C', // teal ink
  '#4E8BBE', // desaturated blue
  '#2F4F7F', // midnight ink
  '#3C3F58', // slate
  '#5E6A71', // cool grey

  '#5C4A7D', // muted plum
  '#8E5A9F', // violet
  '#B55D80', // rose
  '#7F3F5A', // wine red
  '#9B3F3F', // deep crimson
];

export const colors = {
  // Backwards-compat convenience (mirrors default.light primary/secondary)
  primary: '#6750A4',
  secondary: '#625B71',

  /**
   * Default Bookmark theme – light & dark.
   *
   * Based on Material 3 baseline tokens, with your original primary/secondary:
   *   primary:   #6750A4
   *   secondary: #625B71
   */
  default: {
    light: {
      // Brand
      primary: '#6750A4',
      primaryContainer: '#EADDFF',
      onPrimary: '#FFFFFF',

      secondary: '#625B71',
      secondaryContainer: '#E8DEF8',
      onSecondary: '#FFFFFF',

      // Surfaces / background
      background: '#FFFBFE',
      surface: '#FFFBFE',
      surfaceVariant: '#E7E0EC',

      // Text / outline
      onBackground: '#1C1B1F',
      onSurface: '#1C1B1F',
      outline: '#79747E',

      // Chart categorical palette – intentionally high contrast, distinct hues
      chartPalette: [
        '#6750A4', // primary indigo
        '#0B57D0', // blue
        '#386A20', // green
        '#B3261E', // red
        '#FF8A00', // orange/amber
        '#7D5260', // mauve
        '#00677D', // teal
        '#8E3A9D', // violet
      ],
    },

    dark: {
      // Brand
      primary: '#D0BCFF',
      primaryContainer: '#4F378B',
      onPrimary: '#381E72',

      secondary: '#CCC2DC',
      secondaryContainer: '#4A4458',
      onSecondary: '#332D41',

      // Surfaces / background
      background: '#1C1B1F',
      surface: '#1C1B1F',
      surfaceVariant: '#49454F',

      // Text / outline
      onBackground: '#E6E1E5',
      onSurface: '#E6E1E5',
      outline: '#938F99',

      // Chart palette tuned for dark – lighter values so they pop
      chartPalette: [
        '#D0BCFF', // light indigo
        '#AECBFA', // light blue
        '#81C995', // green
        '#F2B8B5', // soft red
        '#FFD54F', // yellow/amber
        '#EFB8C8', // pink
        '#66D4E7', // teal
        '#F6CFFD', // lavender
      ],
    },
  },

  /**
   * Raspberry Lemonade – light & dark palettes.
   *
   * Original allowed colours:
   * #d1507d #f0b4cc #dfd9e8 #a2807e #f6cbdc #f8e8f8
   * #7f5a5d #c8adaf #e9a4a0 #f0c8b8 #ffeddf #862c38
   * #cba278 #a76248 #fff9a7 #fae1cc #ffef62
   */
  raspberryLemonade: {
    light: {
      // Main brand colours (light)
      primary: '#d1507d', // strong pink
      primaryContainer: '#f6cbdc', // soft pink container
      // Tweaked for better contrast on buttons
      onPrimary: '#f6cbdc',

      secondary: '#ffef62', // bright yellow
      secondaryContainer: '#fff9a7', // soft yellow
      onSecondary: '#862c38',

      // Backgrounds / surfaces
      background: '#f8e8f8', // very soft pink
      surface: '#ffeddf', // warm cream
      surfaceVariant: '#fae1cc', // peachy accent

      // Text / outline
      outline: '#7f5a5d',
      onBackground: '#7f5a5d',
      onSurface: '#7f5a5d',

      // Chart palette – candy-ish but distinct
      chartPalette: [
        '#d1507d', // pink
        '#ffef62', // yellow
        '#862c38', // deep berry
        '#e9a4a0', // coral
        '#cba278', // warm tan
        '#dfd9e8', // lilac
        '#a2807e', // soft brown
        '#f0c8b8', // peach
      ],
    },

    // Raspberry Lemonade – dark palette.
    // Proper dark backgrounds, high contrast, same pink/yellow vibe.
    dark: {
      // Brand accents
      primary: '#f0b4cc', // soft pink that pops on dark
      primaryContainer: '#862c38', // deep berry container
      onPrimary: '#2b2328',

      secondary: '#ffef62', // bright yellow accent
      secondaryContainer: '#d1507d',
      onSecondary: '#1b1b1f',

      // Dark surfaces
      background: '#121212',
      surface: '#1e1b20',
      surfaceVariant: '#2b2328',

      // Text / outline
      onBackground: '#f6f0f3',
      onSurface: '#f6f0f3',
      outline: '#a2807e',

      // Chart palette for dark – brighter tints so they stand out
      chartPalette: [
        '#f0b4cc', // pink
        '#ffef62', // yellow
        '#f6cbdc', // light pink
        '#fae1cc', // peach
        '#dfd9e8', // lilac
        '#cba278', // tan
        '#e9a4a0', // coral
        '#f6f0f3', // near-white accent
      ],
    },
  },

  /**
   * Library Shelves – warm wood/paper theme.
   * Light & dark palettes plus a shared chart palette.
   */
  libraryShelves: {
    light: {
      ...libraryShelvesPalette.light,
      chartPalette: libraryChartColors,
    },
    dark: {
      ...libraryShelvesPalette.dark,
      chartPalette: libraryChartColors,
    },
  },
};
