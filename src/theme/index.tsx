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
 * Uses the central palette defined in src/theme/colors.ts.
 */
function buildRaspberryLemonadeLightTheme(base: MD3Theme): MD3Theme {
  const palette = colors.raspberryLemonade.light;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      onPrimary: palette.onPrimary,

      secondary: palette.secondary,
      secondaryContainer: palette.secondaryContainer,
      onSecondary: palette.onSecondary,

      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,

      outline: palette.outline,
      onBackground: palette.onBackground,
      onSurface: palette.onSurface,
    },
  };
}

/**
 * Raspberry Lemonade – dark palette.
 * Uses the central palette defined in src/theme/colors.ts.
 */
function buildRaspberryLemonadeDarkTheme(base: MD3Theme): MD3Theme {
  const palette = colors.raspberryLemonade.dark;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      onPrimary: palette.onPrimary,

      secondary: palette.secondary,
      secondaryContainer: palette.secondaryContainer,
      onSecondary: palette.onSecondary,

      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,

      onBackground: palette.onBackground,
      onSurface: palette.onSurface,
      outline: palette.outline,
    },
  };
}

/**
 * Default Bookmark theme builder (non-Raspberry).
 * Uses the `colors.default` palette.
 */
function buildDefaultTheme(base: MD3Theme, mode: ThemeMode): MD3Theme {
  const palette = mode === 'light' ? colors.default.light : colors.default.dark;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      onPrimary: palette.onPrimary,

      secondary: palette.secondary,
      secondaryContainer: palette.secondaryContainer,
      onSecondary: palette.onSecondary,

      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,

      outline: palette.outline,
      onBackground: palette.onBackground,
      onSurface: palette.onSurface,
    },
  };
}

/**
 * Library Shelves theme builder.
 * Uses the `colors.libraryShelves` palette.
 */
function buildLibraryShelvesTheme(base: MD3Theme, mode: ThemeMode): MD3Theme {
  const palette = mode === 'light' ? colors.libraryShelves.light : colors.libraryShelves.dark;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      onPrimary: palette.onPrimary,

      secondary: palette.secondary,
      secondaryContainer: palette.secondaryContainer,
      onSecondary: palette.onSecondary,

      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,

      outline: palette.outline,
      onBackground: palette.onBackground,
      onSurface: palette.onSurface,
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

    if (themeVariant === 'libraryShelves') {
      return buildLibraryShelvesTheme(base, mode);
    }

    // Default theme: use the structured default palette.
    return buildDefaultTheme(base, mode);
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
