// src/app/providers/AppGate.tsx
// §12 — Gates NavigationContainer behind both DB readiness and theme load.
// DatabaseProvider always renders children; AppGate is the consumer responsible
// for the loading/error state. AppThemeProvider must also be ready (themeLoaded)
// so NavigationContainer never renders with the wrong default theme.
//
// The NavigationContainer receives a custom theme derived from our AppTheme tokens
// so that React Navigation's header and tab bar chrome (background, text, borders)
// updates correctly whenever the user switches between light and dark.
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → DatabaseProvider → AppThemeProvider
//   → ErrorBoundary → QueryClientProvider → AppGate → NavigationContainer

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';

import { useDatabaseContext } from '../database/DatabaseProvider';
import { useThemeContext, useAppTheme } from '../theme';
import { RootNavigator } from '../navigation/RootNavigator';

export function AppGate() {
  const { isReady, error } = useDatabaseContext();
  const { themeLoaded } = useThemeContext();
  const theme = useAppTheme();

  // Build a React Navigation theme from our semantic tokens so the navigation
  // chrome (headers, tab bars) stays in sync with the Paper theme.
  const navigationTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.outlineVariant,
        notification: theme.colors.primary,
      },
    };
  }, [theme]);

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
    <NavigationContainer theme={navigationTheme}>
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
