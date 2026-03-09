// App.tsx
// §12 — Full provider tree. Order is non-negotiable (outermost → innermost):
//   SafeAreaProvider → PaperProvider → ErrorBoundary → QueryClientProvider
//   → DatabaseProvider → AppGate → NavigationContainer
//
// ErrorBoundary sits inside PaperProvider so the crash fallback UI has access
// to Paper components and theme tokens. It covers all crashes in the provider
// and screen tree below it.
//
// NavigationContainer lives inside AppGate and is only rendered when
// the database is ready (isReady = true).

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from './src/app/providers/ErrorBoundary';
import { DatabaseProvider } from './src/app/database/DatabaseProvider';
import { AppGate } from './src/app/providers/AppGate';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <DatabaseProvider>
              <AppGate />
            </DatabaseProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
