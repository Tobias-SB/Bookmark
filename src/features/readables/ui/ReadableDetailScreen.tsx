// src/features/readables/ui/ReadableDetailScreen.tsx
// §9 — Placeholder detail screen. Full implementation (inline updates, delete,
// "View on AO3") is Phase 5.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ReadableDetail'>;

export function ReadableDetailScreen({ route }: Props) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text>Readable Detail — {route.params.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
