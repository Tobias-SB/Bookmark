// src/shared/components/StatusPill.tsx
// Compact read-only status badge. Used wherever a status needs to be displayed
// inline (list items, detail summaries) without being interactive.
//
// For interactive status selection chips (AddEditScreen, ReadableDetailScreen),
// use getStatusColors() from '../../features/readables' directly and style
// the touchable element locally.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '../../app/theme';
import { getStatusColors, STATUS_LABELS_FULL } from '../../features/readables';
import type { ReadableStatus } from '../../features/readables';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  status: ReadableStatus;
  /** Override the displayed label. Defaults to STATUS_LABELS_FULL[status]. */
  label?: string;
}

export function StatusPill({ status, label }: Props): React.JSX.Element {
  const theme = useAppTheme();
  const { bg, text, border } = getStatusColors(status, theme.colors);

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.label, { color: text }]}>
        {label ?? STATUS_LABELS_FULL[status]}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,     // = theme.typography.labelXs
    fontWeight: '600',
  },
});
