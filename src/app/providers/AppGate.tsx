// src/app/providers/AppGate.tsx
// §12 — Reads isReady and error from DatabaseProvider context and gates
// NavigationContainer behind a ready check. DatabaseProvider always renders
// children; AppGate is the consumer responsible for the loading/error state.
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → PaperProvider → QueryClientProvider
//   → DatabaseProvider → AppGate → NavigationContainer

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';

import { useDatabaseContext } from '../database/DatabaseProvider';
import { RootNavigator } from '../navigation/RootNavigator';
import { useAppTheme } from '../theme';

export function AppGate() {
  const { isReady, error } = useDatabaseContext();
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

  if (!isReady) {
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
