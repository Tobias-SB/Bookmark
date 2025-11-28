// Central colour definitions for Bookmark.
//
// - `default` is the main app theme (light + dark) built around the MD3
//   baseline with your original primary/secondary as anchors.
// - `raspberryLemonade` is the playful alternate palette.
// - Top-level `primary` / `secondary` are kept for backwards compatibility
//   and mirror the default light palette.

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
};
