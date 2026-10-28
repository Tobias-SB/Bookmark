import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/app/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Phase 1's SettingsProvider feeds the stored `theme` setting here (spec §8.1, §8.7). */}
      <ThemeProvider preference="system">
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
