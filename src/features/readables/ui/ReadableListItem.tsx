// src/features/readables/ui/ReadableListItem.tsx
// §8 — Memoized list item for the library FlatList.
// Displays: title, author (if present), status, progress summary, kind indicator.
// No tags, summaries, or heavy metadata — keeps items lightweight and fast.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

import { useAppTheme } from '../../../app/theme';
import type { Readable, ReadableStatus } from '../domain/readable';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  completed: 'Completed',
  dnf: 'DNF',
};

/**
 * Formats progress as "current / total unit" per §4.
 * Returns null when both current and total are null (no progress to show).
 * "?" is used for unknown totals.
 */
function formatProgress(readable: Readable): string | null {
  const { progressCurrent, progressTotal, progressUnit } = readable;
  if (progressCurrent === null && progressTotal === null) return null;
  const current = progressCurrent ?? 0;
  const total = progressTotal !== null ? String(progressTotal) : '?';
  return `${current} / ${total} ${progressUnit}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  item: Readable;
  onPress: (id: string) => void;
}

export const ReadableListItem = React.memo(function ReadableListItem({
  item,
  onPress,
}: Props) {
  const theme = useAppTheme();
  const progress = formatProgress(item);

  return (
    <TouchableRipple
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={
        item.author !== null
          ? `${item.title}, by ${item.author}`
          : item.title
      }
    >
      <View style={styles.container}>
        {/* Row 1: title + kind badge */}
        <View style={styles.topRow}>
          <Text
            variant="bodyLarge"
            style={[styles.title, { color: theme.colors.textPrimary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View
            style={[
              styles.kindBadge,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.textSecondary }}
            >
              {item.kind === 'book' ? 'Book' : 'Fanfic'}
            </Text>
          </View>
        </View>

        {/* Row 2: author */}
        {item.author !== null && (
          <Text
            variant="bodySmall"
            style={[styles.author, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.author}
          </Text>
        )}

        {/* Row 3: status · progress */}
        <View style={styles.metaRow}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.textSecondary }}
          >
            {STATUS_LABELS[item.status]}
          </Text>
          {progress !== null && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.textDisabled }}
            >
              {' · '}
              {progress}
            </Text>
          )}
        </View>
      </View>
    </TouchableRipple>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  author: {
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
});
