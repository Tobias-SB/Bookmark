// src/shared/components/EmptyState.tsx
// §8, §13 — Reusable empty state for list and error screens.
// Used for "empty library", "no results", and screen-level error states.
// Callers supply appropriate copy and an optional action button.
//
// NOTE: This establishes the first component pattern in src/shared/components/.
// Future cross-feature UI primitives should follow this file as a template.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useAppTheme } from '../../app/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EmptyState({ title, message, action }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.textPrimary }]}
      >
        {title}
      </Text>

      {message !== undefined && (
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: theme.colors.textSecondary }]}
        >
          {message}
        </Text>
      )}

      {action !== undefined && (
        <Button
          mode="contained"
          onPress={action.onPress}
          style={styles.button}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  button: {
    marginTop: 4,
  },
});
