import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { randomUUID } from 'expo-crypto';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseErrorScreen } from '@/app/DatabaseErrorScreen';
import { ThemeProvider } from '@/app/theme';
import { createExpoDb } from '@/db/createExpoDb';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { runMigrations } from '@/db/migrations';

// Provisional file name; renaming it after release would orphan users' data.
const DATABASE_NAME = 'bookmark.db';

void SplashScreen.preventAutoHideAsync();

async function openAppDatabase() {
  const db = await createExpoDb(DATABASE_NAME);
  await runMigrations(db, { randomUUID });
  return db;
}
const hideSplash = () => {
  SplashScreen.hideAsync().catch(() => undefined);
};

function AppShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      {/* Phase 1's SettingsProvider feeds the stored `theme` setting here (spec §8.1, §8.7). */}
      <ThemeProvider preference="system">
        {children}
        <PortalHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <DatabaseProvider
      open={openAppDatabase}
      onSettled={hideSplash}
      renderError={(retry) => (
        <AppShell>
          <DatabaseErrorScreen onRetry={retry} />
        </AppShell>
      )}
    >
      <AppShell>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
    </DatabaseProvider>
  );
}
