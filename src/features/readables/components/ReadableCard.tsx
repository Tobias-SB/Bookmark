// src/features/readables/components/ReadableCard.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, ProgressBar, Text, useTheme } from 'react-native-paper';
import type { ReadableItem } from '@src/features/readables/types';

interface ReadableCardProps {
  item: ReadableItem;
  onPress: () => void;
}

const ReadableCard: React.FC<ReadableCardProps> = ({ item, onPress }) => {
  const theme = useTheme();

  const typeLabel = item.type === 'book' ? 'Book' : 'Fanfic';

  const progressPercent = item.progressPercent ?? 0;
  const progressValue = Math.max(0, Math.min(100, progressPercent)) / 100;

  let unitLine: string | null = null;
  let metaLine: string | null = null;

  if (item.type === 'book') {
    const totalPages = item.pageCount ?? null;
    const currentPage = item.currentPage ?? null;

    if (currentPage != null && totalPages != null && totalPages > 0) {
      unitLine = `Page ${currentPage} / ${totalPages}`;
    } else if (currentPage != null) {
      unitLine = `Page ${currentPage}`;
    } else if (totalPages != null && totalPages > 0) {
      unitLine = `${totalPages} pages`;
    }

    metaLine = `${progressPercent}%`;
  } else {
    const currentChapter = item.currentChapter ?? null;
    const available = item.availableChapters ?? null;
    const total = item.totalChapters ?? item.chapterCount ?? null;

    const left = available != null ? String(available) : '?';
    const right = total != null ? String(total) : '?';
    const chaptersDisplay = available != null || total != null ? `${left}/${right}` : null;

    if (currentChapter != null && chaptersDisplay) {
      unitLine = `Ch ${currentChapter} • ${chaptersDisplay}`;
    } else if (currentChapter != null) {
      unitLine = `Ch ${currentChapter}`;
    } else if (chaptersDisplay) {
      unitLine = `Chapters ${chaptersDisplay}`;
    }

    metaLine = `${progressPercent}%`;
  }

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title title={item.title} subtitle={item.author} />
      <Card.Content>
        <Text numberOfLines={2} style={styles.description}>
          {item.description || 'No description'}
        </Text>

        <View style={styles.row}>
          <Text style={styles.priority}>Priority: {item.priority}</Text>
          <Chip style={styles.chip}>{typeLabel}</Chip>
        </View>

        <View style={styles.progressContainer}>
          {unitLine && (
            <Text style={[styles.unitText, { color: theme.colors.onSurfaceVariant }]}>
              {unitLine}
            </Text>
          )}
          {metaLine && (
            <Text style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
              {metaLine}
            </Text>
          )}
          <ProgressBar progress={progressValue} style={styles.progressBar} />
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priority: {
    marginRight: 8,
  },
  chip: {
    alignSelf: 'flex-start',
  },
  progressContainer: {
    marginTop: 4,
  },
  unitText: {
    fontSize: 12,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12,
    marginBottom: 2,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
  },
});

export default ReadableCard;
