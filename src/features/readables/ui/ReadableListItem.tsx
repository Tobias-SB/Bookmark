// src/features/readables/ui/ReadableListItem.tsx
// §8 — Memoized list item for the library FlatList.
// Displays: kind accent strip, cover thumbnail (image when available, placeholder otherwise),
// title, author (with authorType handling), status pill, progress bar, progress string,
// fandom tag (fanfic only). No tags, summaries, or heavy metadata.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../../../app/theme';
import type { AppTheme } from '../../../app/theme';
import type { Readable, ReadableStatus } from '../domain/readable';
import { STATUS_LABELS_FULL, formatProgressString } from '../domain/readable';
import { lighten, darken } from '../../../shared/utils/colorUtils';

// ── Status pill helper ────────────────────────────────────────────────────────

function getPillStyle(status: ReadableStatus, colors: AppTheme['colors']) {
  switch (status) {
    case 'reading':
      return {
        backgroundColor: colors.statusReadingBg,
        color: colors.statusReadingText,
        borderWidth: 0,
        borderColor: undefined,
      };
    case 'completed':
      return {
        backgroundColor: colors.statusCompletedBg,
        color: colors.statusCompletedText,
        borderWidth: 0,
        borderColor: undefined,
      };
    case 'dnf':
      return {
        backgroundColor: colors.backgroundInput,
        color: colors.textBody,
        borderWidth: 1,
        borderColor: colors.backgroundBorder,
      };
    case 'want_to_read':
      return {
        backgroundColor: colors.backgroundInput,
        color: colors.textMeta,
        borderWidth: 1,
        borderColor: colors.backgroundBorder,
      };
  }
}

// ── Progress string ───────────────────────────────────────────────────────────

function getProgressText(item: Readable): string {
  if (item.kind === 'book') {
    return formatProgressString(item.progressCurrent, item.totalUnits, item.progressUnit) ?? '';
  }
  // Fanfic
  const cur = item.progressCurrent;
  const avail = item.availableChapters;
  const total = item.totalUnits;

  if (avail === 1 && total === 1) return '1 chapter';
  if (cur !== null && avail !== null) return `ch. ${cur} · ${avail}/${total ?? '?'} avail.`;
  if (avail !== null) return `${avail}/${total ?? '?'} ch.`;
  return '';
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
  const { colors } = theme;

  // Author display — authorType overrides raw author string for anonymous/orphaned works
  const displayAuthor =
    item.authorType === 'anonymous' ? 'Anonymous' :
    item.authorType === 'orphaned'  ? 'Orphaned work' :
    item.author;

  // Progress
  const progressText = getProgressText(item);

  // Progress bar percentage — kind-specific denominator.
  // For fanfic, prefer availableChapters (supports ? totalUnits); fall back to totalUnits.
  const fanficDenominator = item.availableChapters ?? item.totalUnits;
  const pct =
    item.kind === 'book'
      ? (item.progressCurrent && item.totalUnits
          ? Math.round((item.progressCurrent / item.totalUnits) * 100)
          : 0)
      : (item.progressCurrent && fanficDenominator
          ? Math.round((item.progressCurrent / fanficDenominator) * 100)
          : 0);

  const showProgressBar = pct > 0 || item.status === 'reading';

  // Kind accent colour + gradient stops for spine
  const accentColor = item.kind === 'book' ? colors.kindBook : colors.kindFanfic;
  const subtleColor = item.kind === 'book' ? colors.kindBookSubtle : colors.kindFanficSubtle;
  const spineGradient: [string, string, string] = [
    lighten(accentColor, 0.12),
    accentColor,
    darken(accentColor, 0.12),
  ];

  // Status pill
  const pillStyle = getPillStyle(item.status, colors);

  // Accessible card label
  const cardLabel = [
    item.title,
    displayAuthor ?? '',
    STATUS_LABELS_FULL[item.status],
    progressText,
  ].filter(Boolean).join(', ');

  return (
    <TouchableRipple
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={cardLabel}
      style={[styles.card, theme.shadows.card, { borderRadius: theme.radii.card, backgroundColor: colors.backgroundCard }]}
    >
      <View style={styles.row}>
        {/* Kind accent strip — gradient spine */}
        <LinearGradient
          colors={spineGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accentStrip}
        />

        {/* Content row */}
        <View style={styles.content}>
          {/* Thumbnail — image if available, placeholder otherwise */}
          <View style={[styles.thumbnail, { backgroundColor: subtleColor }]}>
            {item.coverUrl !== null ? (
              <Image
                source={{ uri: item.coverUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailSpine} />
            )}
          </View>

          {/* Text block */}
          <View style={styles.textBlock}>
            {/* Title */}
            <Text
              variant="bodyLarge"
              numberOfLines={2}
              style={{ color: colors.textPrimary }}
            >
              {item.title}
            </Text>

            {/* Author */}
            {displayAuthor !== null && (
              <Text
                numberOfLines={1}
                style={[styles.author, { color: colors.textBody }]}
              >
                {displayAuthor}
              </Text>
            )}

            {/* Meta row: status pill + progress string */}
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: pillStyle.backgroundColor,
                    borderWidth: pillStyle.borderWidth,
                    borderColor: pillStyle.borderColor,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: pillStyle.color }]}>
                  {STATUS_LABELS_FULL[item.status]}
                </Text>
              </View>
              {progressText !== '' && (
                <Text style={[styles.progressText, { color: colors.textMeta }]}>
                  {progressText}
                </Text>
              )}
            </View>

            {/* Progress bar */}
            {showProgressBar && (
              <View
                style={[styles.progressTrack, { backgroundColor: colors.backgroundInput }]}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: pct }}
                accessibilityLabel={`${pct}% complete`}
              >
                {pct > 0 && (
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor:
                          item.status === 'completed'
                            ? colors.statusCompletedText
                            : accentColor,
                      },
                    ]}
                  />
                )}
              </View>
            )}

            {/* Fandom tag — fanfic only */}
            {item.kind === 'fanfic' && item.fandom.length > 0 && (
              <Text
                numberOfLines={1}
                style={[styles.fandom, { color: colors.kindFanfic }]}
              >
                {item.fandom.join(', ')}
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
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  accentStrip: {
    width: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 13,
    gap: 11,
  },
  thumbnail: {
    width: 42,
    height: 58,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbnailSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  textBlock: {
    flex: 1,
  },
  author: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressText: {
    fontSize: 11,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  fandom: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
