// src/features/readables/ui/AddEditScreen.tsx
// §10 — Placeholder add/edit screen. id absent = add mode; id present = edit mode.
// Full implementation (RHF + Zod form, kind selector, metadata prefill) is Phase 5.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditReadable'>;

export function AddEditScreen({ route }: Props) {
  const theme = useAppTheme();
  const mode = route.params.id ? 'Edit' : 'Add';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text>
        {mode} Readable{route.params.id ? ` — ${route.params.id}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
