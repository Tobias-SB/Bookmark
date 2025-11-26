// src/theme/index.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  MD3DarkTheme as DefaultDarkTheme,
  MD3LightTheme as DefaultLightTheme,
  Provider as PaperProvider,
  type MD3Theme,
} from 'react-native-paper';
import { colors } from './colors';
import {
  loadSettings,
  saveSettings,
  type ThemePreference,
  type ThemeVariant,
} from '@src/features/settings/services/settingsRepository';

export type ThemeMode = 'light' | 'dark';

interface AppThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  themeVariant: ThemeVariant;
  setThemeVariant: (variant: ThemeVariant) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

/**
 * Raspberry Lemonade – light palette.
 * Uses only the provided colours, with pink and yellow as the main colours.
 *
 * Allowed colours:
 * #d1507d #f0b4cc #dfd9e8 #a2807e #f6cbdc #f8e8f8
 * #7f5a5d #c8adaf #e9a4a0 #f0c8b8 #ffeddf #862c38
 * #cba278 #a76248 #fff9a7 #fae1cc #ffef62
 */
function buildRaspberryLemonadeLightTheme(base: MD3Theme): MD3Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      // Main brand colours (light)
      primary: '#d1507d', // strong pink
      primaryContainer: '#f6cbdc', // soft pink container
      // You tweaked this for better contrast on buttons
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
    },
  };
}

/**
 * Raspberry Lemonade – dark palette.
 * Here we prioritise usability: proper dark backgrounds and high contrast,
 * but keep Raspberry Lemonade as the accent vibe (pink + yellow).
 *
 * We’re allowed to use additional colours beyond the original light palette.
 */
function buildRaspberryLemonadeDarkTheme(base: MD3Theme): MD3Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
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
    },
  };
}

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [themeVariant, setThemeVariantState] = useState<ThemeVariant>('default');

  // Load initial theme from SQLite
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const settings = await loadSettings();
        if (!isMounted) {
          return;
        }

        const pref = settings.themePreference;
        const initialMode: ThemeMode = pref === 'dark' ? 'dark' : 'light';
        setMode(initialMode);
        setThemeVariantState(settings.themeVariant ?? 'default');
      } catch {
        // If loading fails, we just stick with the defaults.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const paperTheme = useMemo(() => {
    const base = mode === 'light' ? DefaultLightTheme : DefaultDarkTheme;

    if (themeVariant === 'raspberryLemonade') {
      return mode === 'light'
        ? buildRaspberryLemonadeLightTheme(base)
        : buildRaspberryLemonadeDarkTheme(base);
    }

    // Default theme: keep your existing overrides.
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        secondary: colors.secondary,
      },
    };
  }, [mode, themeVariant]);

  const persistSettings = (nextMode: ThemeMode, nextVariant: ThemeVariant) => {
    const preference: ThemePreference = nextMode; // map directly: 'light' | 'dark'
    // Fire-and-forget persistence
    saveSettings({ themePreference: preference, themeVariant: nextVariant }).catch(() => {
      // In a real app you might log this somewhere.
    });
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      persistSettings(next, themeVariant);
      return next;
    });
  };

  const setThemeVariant = (variant: ThemeVariant) => {
    setThemeVariantState((prev) => {
      const next = variant;
      persistSettings(mode, next);
      return next;
    });
  };

  const ctxValue = useMemo(
    () => ({
      mode,
      toggleMode,
      themeVariant,
      setThemeVariant,
    }),
    [mode, themeVariant],
  );

  return (
    <AppThemeContext.Provider value={ctxValue}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </AppThemeContext.Provider>
  );
};

export const useAppThemeMode = (): AppThemeContextValue => {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppThemeMode must be used within AppThemeProvider');
  }
  return ctx;
};
