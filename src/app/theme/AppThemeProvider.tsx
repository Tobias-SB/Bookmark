// src/app/theme/AppThemeProvider.tsx
// NOTE: This establishes the AppThemeProvider pattern in src/app/theme/.
// Manages colour mode (light/dark/system) separately from the colour palette.
//
// ThemeName — the colour palette. Currently only 'default' (Scholar's Library base);
//   extend THEME_REGISTRY and APP_THEME_OVERRIDES when additional palettes are added.
// ColorMode — how light/dark is resolved ('light' | 'dark' | 'system').
//   'system' follows the device colour scheme via useColorScheme().
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → DatabaseProvider → AppThemeProvider
//   → (PaperProvider rendered internally) → ErrorBoundary → QueryClientProvider
//   → AppGate → NavigationContainer
//
// themeLoaded is false until both saved preferences have been read (or failed).
// AppGate waits for themeLoaded before rendering NavigationContainer so the
// navigation tree never renders with the wrong default theme.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { useDatabaseContext } from '../database/DatabaseProvider';
import { getSetting, setSetting, SETTINGS_KEYS } from '../database/settingsRepository';
import type { AppThemeOverrideSet } from './tokens';

// ── Theme registry ─────────────────────────────────────────────────────────────
// Add new palettes here. Each entry must supply both light and dark MD3 variants.
// Scholar's Library uses the MD3 default themes — only semantic tokens differ.

export type ThemeName = 'default';
// To add a theme: extend the union → 'default' | 'ocean_modern'
// Then add an entry to THEME_REGISTRY and APP_THEME_OVERRIDES below.

export type ColorMode = 'light' | 'dark' | 'system';

type ThemeVariants = { light: MD3Theme; dark: MD3Theme };

const THEME_REGISTRY: Record<ThemeName, ThemeVariants> = {
  default: { light: MD3LightTheme, dark: MD3DarkTheme },
};

const DEFAULT_THEME_NAME: ThemeName = 'default';
const DEFAULT_COLOR_MODE: ColorMode = 'system';

function isThemeName(value: string): value is ThemeName {
  return Object.prototype.hasOwnProperty.call(THEME_REGISTRY, value);
}

function isColorMode(value: string): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

// ── Override registry ──────────────────────────────────────────────────────────
// Each theme entry provides light and dark delta objects. Only tokens that differ
// from the Scholar's Library base (makeTokens) need to be supplied. The default
// theme has no overrides — Scholar's Library values come from makeTokens itself.
//
// To add a theme:
//   1. Extend ThemeName union above.
//   2. Add THEME_REGISTRY entry (MD3 base themes).
//   3. Add APP_THEME_OVERRIDES entry with token deltas.
//   4. Add a chip to SettingsScreen theme selector.

export const APP_THEME_OVERRIDES: Record<
  ThemeName,
  { light: AppThemeOverrideSet; dark: AppThemeOverrideSet }
> = {
  default: { light: {}, dark: {} },
};

// ── Context ────────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  themeName: ThemeName;
  colorMode: ColorMode;
  /** True once both saved preferences have been read from the database (or failed). */
  themeLoaded: boolean;
  setTheme: (name: ThemeName) => Promise<void>;
  setColorMode: (mode: ColorMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: DEFAULT_THEME_NAME,
  colorMode: DEFAULT_COLOR_MODE,
  themeLoaded: false,
  setTheme: async () => {},
  setColorMode: async () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────────

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const { db, isReady } = useDatabaseContext();
  const systemScheme = useColorScheme();

  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [colorMode, setColorModeState] = useState<ColorMode>(DEFAULT_COLOR_MODE);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Load both persisted preferences once the database is ready.
  // Fails open — defaults remain active and themeLoaded is set to true.
  useEffect(() => {
    if (!isReady || !db) return;

    async function loadPreferences() {
      try {
        const [savedTheme, savedMode] = await Promise.all([
          getSetting(db!, SETTINGS_KEYS.theme),
          getSetting(db!, SETTINGS_KEYS.colorMode),
        ]);
        if (savedTheme !== null && isThemeName(savedTheme)) {
          setThemeNameState(savedTheme);
        }
        if (savedMode !== null && isColorMode(savedMode)) {
          setColorModeState(savedMode);
        }
      } catch {
        // Fail open — defaults remain active.
      } finally {
        setThemeLoaded(true);
      }
    }

    void loadPreferences();
  }, [isReady, db]);

  const setTheme = useCallback(
    async (name: ThemeName) => {
      setThemeNameState(name);
      if (!db) return;
      try {
        await setSetting(db, SETTINGS_KEYS.theme, name);
      } catch {
        // Non-fatal — in-memory state updated; reverts on cold start.
      }
    },
    [db],
  );

  const setColorMode = useCallback(
    async (mode: ColorMode) => {
      setColorModeState(mode);
      if (!db) return;
      try {
        await setSetting(db, SETTINGS_KEYS.colorMode, mode);
      } catch {
        // Non-fatal — in-memory state updated; reverts on cold start.
      }
    },
    [db],
  );

  // Resolve which MD3 theme to pass to PaperProvider.
  // 'system' follows the device colour scheme; 'unspecified' and null fall back to light.
  const effectiveMode: 'light' | 'dark' =
    colorMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : colorMode;
  const resolvedTheme = THEME_REGISTRY[themeName][effectiveMode];

  return (
    <ThemeContext.Provider value={{ themeName, colorMode, themeLoaded, setTheme, setColorMode }}>
      <PaperProvider theme={resolvedTheme}>
        {children}
      </PaperProvider>
    </ThemeContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
