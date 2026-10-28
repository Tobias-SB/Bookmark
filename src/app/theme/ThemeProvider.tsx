import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useLayoutEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';

import { resolveTheme, type ThemePreference } from './resolveTheme';

type ThemeProviderProps = {
  preference: ThemePreference;
  children: ReactNode;
};

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [applied, setApplied] = useState(false);

  // 'system' goes to Uniwind unchanged: on native, an explicit light or dark pins Appearance and stops it following the device.
  useLayoutEffect(() => {
    Uniwind.setTheme(preference);
    setApplied(true);
  }, [preference]);

  // Render nothing until the first theme is applied, so the first painted frame is already themed.
  if (!applied) return null;

  const resolved = resolveTheme(preference, systemScheme);
  return (
    <>
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
      {children}
    </>
  );
}
