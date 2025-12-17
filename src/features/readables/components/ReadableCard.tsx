import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, ProgressBar, Text, useTheme } from 'react-native-paper';
import type { ReadableItem } from '@src/features/readables/types';

interface ReadableCardProps {
  item: ReadableItem;
  onPress: () => void;
}

function formatHms(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.floor(seconds);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(
    2,
    '0',
  )}`;
}

const ReadableCard: React.FC<ReadableCardProps> = ({ item, onPress }) => {
  const theme = useTheme();

  const typeLabel = item.type === 'book' ? 'Book' : 'Fanfic';

  const progressPercent = item.progressPercent ?? 0;
  const progressValue = Math.max(0, Math.min(100, progressPercent)) / 100;

  let primaryLine: string | null = null;

  if (item.progressMode === 'time') {
    const cur = formatHms(item.timeCurrentSeconds ?? null);
    const tot =
      item.timeTotalSeconds != null && item.timeTotalSeconds > 0
        ? formatHms(item.timeTotalSeconds)
        : null;
    primaryLine = tot ? `${cur} / ${tot}` : cur;
  } else if (item.progressMode === 'percent') {
    primaryLine = `${progressPercent}%`;
  } else {
    // units (pages/chapters)
    if (item.type === 'book') {
      const totalPages = item.pageCount ?? null;
      const currentPage = item.currentPage ?? null;

      if (currentPage != null && totalPages != null && totalPages > 0) {
        primaryLine = `Page ${currentPage} / ${totalPages}`;
      } else if (currentPage != null) {
        primaryLine = `Page ${currentPage}`;
      } else if (totalPages != null && totalPages > 0) {
        primaryLine = `${totalPages} pages`;
      } else {
        primaryLine = `${progressPercent}%`;
      }
    } else {
      const currentChapter = item.currentChapter ?? null;

      let availableChapters = item.availableChapters ?? null;
      let totalChapters = item.totalChapters ?? null;

      if (availableChapters == null && totalChapters == null && item.chapterCount != null) {
        availableChapters = item.chapterCount;
      }

      if (item.complete && availableChapters != null && totalChapters == null) {
        totalChapters = availableChapters;
      }

      const left = availableChapters != null ? String(availableChapters) : '?';
      const right = totalChapters != null ? String(totalChapters) : '?';
      const chaptersDisplay =
        availableChapters != null || totalChapters != null ? `${left}/${right}` : null;

      if (currentChapter != null && chaptersDisplay) {
        primaryLine = `Ch ${currentChapter} • ${chaptersDisplay}`;
      } else if (currentChapter != null) {
        primaryLine = `Ch ${currentChapter}`;
      } else if (chaptersDisplay) {
        primaryLine = `Chapters ${chaptersDisplay}`;
      } else {
        primaryLine = `${progressPercent}%`;
      }
    }
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
          {primaryLine ? (
            <Text style={[styles.primaryText, { color: theme.colors.onSurfaceVariant }]}>
              {primaryLine}
            </Text>
          ) : null}

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
  primaryText: {
    fontSize: 12,
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
  },
});

export default ReadableCard;
