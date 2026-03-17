// src/features/readables/ui/ReadableListItem.tsx
// §8 — Memoized list item for the library FlatList.
// Displays: cover thumbnail (when available), title, author (if present),
// status, progress summary, kind indicator.
// No tags, summaries, or heavy metadata — keeps items lightweight and fast.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

import { useAppTheme } from '../../../app/theme';
import type { Readable } from '../domain/readable';
import { STATUS_LABELS_FULL, KIND_LABELS, formatProgressString } from '../domain/readable';

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
  const progress = formatProgressString(item.progressCurrent, item.totalUnits, item.progressUnit);
  const hasCover = item.coverUrl !== null;

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
        {/* Cover thumbnail — only when available */}
        {hasCover && (
          <Image
            source={{ uri: item.coverUrl! }}
            style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]}
            resizeMode="cover"
          />
        )}

        {/* Text content */}
        <View style={styles.content}>
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
                {KIND_LABELS[item.kind]}
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
              {STATUS_LABELS_FULL[item.status]}
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
      </View>
    </TouchableRipple>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cover: {
    width: 48,
    height: 64,
    borderRadius: 4,
    flexShrink: 0,
  },
  content: {
    flex: 1,
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
