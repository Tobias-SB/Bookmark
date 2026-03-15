// App.tsx
// §12 — Full provider tree. Order (outermost → innermost):
//
//   SafeAreaProvider → DatabaseProvider → AppThemeProvider
//   → ErrorBoundary → QueryClientProvider → AppGate → NavigationContainer
//
// DEVIATION FROM REFERENCE DOC: DatabaseProvider is above AppThemeProvider
// (and therefore above PaperProvider) so the persisted theme can be read before
// PaperProvider renders. All original constraints are still satisfied:
//   - ErrorBoundary is inside PaperProvider (AppThemeProvider renders it internally).
//   - NavigationContainer is gated on both isReady AND themeLoaded (via AppGate).
//   - Screens have access to both DB and TanStack Query because NavigationContainer
//     is inside both DatabaseProvider and QueryClientProvider.
//
// AppThemeProvider internally renders PaperProvider with the persisted theme.

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DatabaseProvider } from './src/app/database/DatabaseProvider';
import { AppThemeProvider } from './src/app/theme/AppThemeProvider';
import { ErrorBoundary } from './src/app/providers/ErrorBoundary';
import { AppGate } from './src/app/providers/AppGate';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AppThemeProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppGate />
            </QueryClientProvider>
          </ErrorBoundary>
        </AppThemeProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
