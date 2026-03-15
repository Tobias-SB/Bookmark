// src/app/providers/AppGate.tsx
// §12 — Gates NavigationContainer behind both DB readiness and theme load.
// DatabaseProvider always renders children; AppGate is the consumer responsible
// for the loading/error state. AppThemeProvider must also be ready (themeLoaded)
// so NavigationContainer never renders with the wrong default theme.
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → DatabaseProvider → AppThemeProvider
//   → ErrorBoundary → QueryClientProvider → AppGate → NavigationContainer

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';

import { useDatabaseContext } from '../database/DatabaseProvider';
import { useThemeContext, useAppTheme } from '../theme';
import { RootNavigator } from '../navigation/RootNavigator';

export function AppGate() {
  const { isReady, error } = useDatabaseContext();
  const { themeLoaded } = useThemeContext();
  const theme = useAppTheme();

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error }}>
          Failed to initialise database: {error.message}
        </Text>
      </View>
    );
  }

  if (!isReady || !themeLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
