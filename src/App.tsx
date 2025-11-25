// src/App.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Text } from 'react-native-paper';
import RootNavigator from '@src/navigation/RootNavigator';
import { AppThemeProvider } from '@src/theme';
import { runMigrations } from '@src/db/migrations';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await runMigrations();
      } finally {
        if (isMounted) {
          setIsDbReady(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            {isDbReady ? (
              <>
                <RootNavigator />
                <StatusBar style="auto" />
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Preparing database…</Text>
              </View>
            )}
          </NavigationContainer>
        </SafeAreaProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
  },
});

export default App;
