import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useLayoutEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';

import { resolveTheme, type ThemePreference } from './resolveTheme';

type ThemeProviderProps = {
  preference: ThemePreference;
  children: ReactNode;
};

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();

  // A layout effect runs before paint, so the first painted frame already has the theme.
  // 'system' goes to Uniwind unchanged: on native, an explicit light or dark pins Appearance and stops it following the device.
  useLayoutEffect(() => {
    Uniwind.setTheme(preference);
  }, [preference]);

  const resolved = resolveTheme(preference, systemScheme);
  return (
    <>
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
      {children}
    </>
  );
}
