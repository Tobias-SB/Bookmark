// src/app/theme/AppThemeProvider.tsx
// NOTE: This establishes the AppThemeProvider pattern in src/app/theme/.
// Manages theme selection, persists the preference to SQLite, and renders
// PaperProvider with the correct MD3 theme.
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → DatabaseProvider → AppThemeProvider
//   → (PaperProvider rendered internally) → ErrorBoundary → QueryClientProvider
//   → AppGate → NavigationContainer
//
// themeLoaded is false until the saved preference has been read (or failed).
// AppGate waits for themeLoaded before rendering NavigationContainer so the
// navigation tree never renders with the wrong default theme.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { useDatabaseContext } from '../database/DatabaseProvider';
import { getSetting, setSetting, SETTINGS_KEYS } from '../database/settingsRepository';

// ── Theme registry ────────────────────────────────────────────────────────────
// Extend this record when additional themes are added in future updates.

export type ThemeName = 'light' | 'dark';

const PAPER_THEMES: Record<ThemeName, MD3Theme> = {
  light: MD3LightTheme,
  dark: MD3DarkTheme,
};

const DEFAULT_THEME: ThemeName = 'light';

function isThemeName(value: string): value is ThemeName {
  return Object.prototype.hasOwnProperty.call(PAPER_THEMES, value);
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  themeName: ThemeName;
  /** True once the saved preference has been read from the database (or failed). */
  themeLoaded: boolean;
  setTheme: (name: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: DEFAULT_THEME,
  themeLoaded: false,
  setTheme: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const { db, isReady } = useDatabaseContext();
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Load persisted theme once the database is ready. Fails open — the default
  // theme is set and themeLoaded is still set to true so AppGate unblocks.
  useEffect(() => {
    if (!isReady || !db) return;

    async function loadTheme() {
      try {
        const saved = await getSetting(db!, SETTINGS_KEYS.theme);
        if (saved !== null && isThemeName(saved)) {
          setThemeName(saved);
        }
      } catch {
        // Fail open — default theme remains active.
      } finally {
        setThemeLoaded(true);
      }
    }

    void loadTheme();
  }, [isReady, db]);

  const setTheme = useCallback(
    async (name: ThemeName) => {
      // Update state immediately for instant visual feedback.
      setThemeName(name);
      if (!db) return;
      try {
        await setSetting(db, SETTINGS_KEYS.theme, name);
      } catch {
        // Persist failure is non-fatal — in-memory state is already updated.
        // The preference reverts to the previous value on next cold start.
      }
    },
    [db],
  );

  return (
    <ThemeContext.Provider value={{ themeName, themeLoaded, setTheme }}>
      <PaperProvider theme={PAPER_THEMES[themeName]}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
