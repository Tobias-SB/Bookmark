// App.tsx
// §12 — Full provider tree. Order is non-negotiable (outermost → innermost):
//   SafeAreaProvider → PaperProvider → QueryClientProvider
//   → DatabaseProvider → AppGate → NavigationContainer
//
// NavigationContainer lives inside AppGate and is only rendered when
// the database is ready (isReady = true).

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DatabaseProvider } from './src/app/database/DatabaseProvider';
import { AppGate } from './src/app/providers/AppGate';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <QueryClientProvider client={queryClient}>
          <DatabaseProvider>
            <AppGate />
          </DatabaseProvider>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
