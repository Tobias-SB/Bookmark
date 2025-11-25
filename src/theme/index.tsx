// src/theme/index.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  MD3DarkTheme as DefaultDarkTheme,
  MD3LightTheme as DefaultLightTheme,
  Provider as PaperProvider,
} from 'react-native-paper';
import { colors } from './colors';
import {
  loadSettings,
  saveSettings,
  type ThemePreference,
} from '@src/features/settings/services/settingsRepository';

export type ThemeMode = 'light' | 'dark';

interface AppThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

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
      } catch {
        // If loading fails, we just stick with the default light mode.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const paperTheme = useMemo(() => {
    const base = mode === 'light' ? DefaultLightTheme : DefaultDarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        secondary: colors.secondary,
      },
    };
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      const preference: ThemePreference = next; // we only toggle between 'light' and 'dark'

      // Fire-and-forget persistence, ignore errors.
      saveSettings({ themePreference: preference }).catch(() => {
        // In a real app you might log this somewhere.
      });

      return next;
    });
  };

  const ctxValue = useMemo(() => ({ mode, toggleMode }), [mode]);

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
