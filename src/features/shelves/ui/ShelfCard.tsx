// src/features/shelves/ui/ShelfCard.tsx
// Displays a single shelf in collapsed (spine row) or expanded (card list) state.
//
// Collapsed: horizontal scroll of coloured book-spine rectangles with rotated titles.
// Expanded:  vertical list of ReadableListItem cards.
//
// Animation: LayoutAnimation.easeInEaseOut for the height transition (no extra deps).
// Reduce-motion: guard configureNext behind AccessibilityInfo.isReduceMotionEnabled.
//
// Spine width proportional to work length (clamped 12–44px):
//   - book:   totalUnits (pages), 0–600 range mapped to 12–44px.
//   - fanfic: wordCount,          0–100 000 range mapped to 12–44px.
//   - default (no data): 20px.
//
// Spine colour: kindBook / kindFanfic token as the gradient midpoint.
// Adjacent same-kind spines alternate with a +5% lightness offset.
//
// Long-press on header → onEdit callback (rename / delete options).

import React, { useState } from 'react';
import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { Readable } from '../../readables/domain/readable';
import { ReadableListItem } from '../../readables/ui/ReadableListItem';
import { darken, lighten } from '../../../shared/utils/colorUtils';
import type { Shelf } from '../domain/shelf';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Spine helpers ─────────────────────────────────────────────────────────────

const SPINE_MIN = 12;
const SPINE_MAX = 44;
const SPINE_HEIGHT = 80;

function spineWidth(readable: Readable): number {
  if (readable.kind === 'book' && readable.totalUnits != null) {
    // 0–600 pages → 12–44px
    const ratio = Math.min(readable.totalUnits, 600) / 600;
    return Math.round(SPINE_MIN + ratio * (SPINE_MAX - SPINE_MIN));
  }
  if (readable.kind === 'fanfic' && readable.wordCount != null) {
    // 0–100 000 words → 12–44px
    const ratio = Math.min(readable.wordCount, 100_000) / 100_000;
    return Math.round(SPINE_MIN + ratio * (SPINE_MAX - SPINE_MIN));
  }
  return 20;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  shelf: Shelf;
  readables: Readable[];
  onEdit: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShelfCard({ shelf, readables, onEdit }: Props) {
  const theme = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setExpanded((prev) => !prev);
    });
  }

  function handleItemPress(id: string) {
    navigation.navigate('ReadableDetail', { id });
  }

  const count = readables.length;
  const a11yLabel = `${shelf.name}, ${count} item${count === 1 ? '' : 's'}, ${expanded ? 'expanded' : 'collapsed'}`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.backgroundCard,
          borderRadius: theme.radii.card,
          ...theme.shadows.card,
        },
      ]}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleToggle}
        onLongPress={onEdit}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Double tap to expand or collapse. Long press for options."
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[styles.shelfName, { color: theme.colors.textBody }]}
            numberOfLines={1}
          >
            {shelf.name}
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.kindBookSubtle, borderColor: theme.colors.kindBookBorder },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.kindBook }]}>
              {count}
            </Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: theme.colors.textMeta }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* ── Body: spine row (collapsed) or card list (expanded) ───────────── */}
      {expanded ? (
        <View style={styles.expandedBody}>
          {readables.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMeta }]}>
              No readables on this shelf yet.
            </Text>
          ) : (
            <View style={styles.expandedList}>
              {readables.map((item) => (
                <ReadableListItem key={item.id} item={item} onPress={handleItemPress} />
              ))}
            </View>
          )}
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Collapse shelf"
            style={[styles.collapseBar, { borderTopColor: theme.colors.backgroundBorder }]}
          >
            <Text style={[styles.collapseBarText, { color: theme.colors.textMeta }]}>
              ▲ Collapse
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {count === 0 ? (
            <Text style={[styles.emptySpineText, { color: theme.colors.textMeta }]}>
              No readables yet. Add one from the detail screen.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.spineRow}
            >
              {readables.map((readable, index) => {
                const isBook = readable.kind === 'book';
                const baseColor = isBook ? theme.colors.kindBook : theme.colors.kindFanfic;
                // Alternate slight lightness on adjacent same-kind spines
                const isAltShade = index % 2 === 1;
                const midColor = isAltShade ? lighten(baseColor, 0.05) : baseColor;
                const topColor = lighten(midColor, 0.12);
                const bottomColor = darken(midColor, 0.10);

                return (
                  <View
                    key={readable.id}
                    style={[styles.spine, { width: spineWidth(readable) }]}
                  >
                    <LinearGradient
                      colors={[topColor, midColor, bottomColor]}
                      locations={[0, 0.5, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.spineTitle,
                        { color: theme.colors.textOnPrimary },
                      ]}
                    >
                      {readable.title}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
          {/* Shelf surface ledge — antiquarian gold */}
          <View
            style={[
              styles.shelfSurface,
              { backgroundColor: theme.colors.statusCompletedBorder },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  shelfName: {
    fontSize: 17, // titleSm
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 11, // labelXs
    fontWeight: '600',
  },
  chevron: {
    fontSize: 11,
    marginLeft: 8,
  },
  spineRow: {
    paddingHorizontal: 14,
    paddingBottom: 0,
    gap: 2,
    alignItems: 'flex-end',
  },
  spine: {
    height: SPINE_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spineTitle: {
    fontSize: 9, // badge
    fontWeight: '600',
    transform: [{ rotate: '90deg' }],
    width: SPINE_HEIGHT - 8,
    textAlign: 'center',
  },
  shelfSurface: {
    height: 6,
    marginHorizontal: 0,
  },
  expandedBody: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  expandedList: {
    gap: 10,
    paddingTop: 4,
  },
  collapseBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  collapseBarText: {
    fontSize: 12, // labelSm
    fontWeight: '500',
  },
  emptySpineText: {
    fontSize: 13, // labelMd
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 12,
    textAlign: 'center',
  },
});
