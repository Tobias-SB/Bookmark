import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

// shortcut: reads a preset theme from the URL for S17 checks; Task 3 replaces this with ThemeProvider fed by settings.
function presetTheme(): 'light' | 'dark' | 'black' | 'system' {
  if (typeof location === 'undefined') return 'system';
  const value = new URLSearchParams(location.search).get('theme');
  return value === 'light' || value === 'dark' || value === 'black' ? value : 'system';
}

export default function RootLayout() {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    Uniwind.setTheme(presetTheme());
    setThemeReady(true);
  }, []);

  // Hold rendering until the theme is applied so the first painted frame is already themed.
  if (!themeReady) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </SafeAreaProvider>
  );
}
