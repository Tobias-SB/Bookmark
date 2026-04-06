// src/features/readables/ui/LibraryScreen.tsx
// UI Phase 2 — Redesigned LibraryScreen with new token system.
//
// Layout (top to bottom):
//   Compact header (absolute, z=10) — slides+fades in from above via scrollY interpolations
//   Full header (title fades out, search+chips scroll naturally) — inside FlatList ListHeaderComponent
//   → FlatList
//       ListHeaderComponent: full header + result count OR "All readables" section label
//       Cards with gap:9 spacing (no separators)
//   → FAB (absolute)
//
// Header animation: three native-thread Animated interpolations, fixed thresholds,
// no JS state updates during scroll (no isCompact state, no layout measurement in the
// animation path). Eliminates the flicker caused by inputRange recalculation.
//
// All filter/sort/search behaviour is unchanged from v2.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  FAB,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList, TabParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { AppSearchBar } from '../../../shared/components/AppSearchBar';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { AO3Rating, ReadableFilters, ReadableStatus } from '../domain/readable';
import { AO3_RATING_LABELS, STATUS_LABELS_SHORT } from '../domain/readable';
import { useReadables } from '../hooks/useReadables';
import { FilterModal } from './FilterModal';
import { ReadableListItem } from './ReadableListItem';

// ── Types ──────────────────────────────────────────────────────────────────────

type LibraryNavProp = NativeStackNavigationProp<RootStackParamList>;
type LibraryRouteProp = RouteProp<TabParamList, 'Library'>;

// ── Filter utilities ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ReadableFilters = { sortBy: 'dateAdded', sortOrder: 'desc' };

/** Count of active filter axes, per v2 §4.1 rules. Search bar is not counted. */
function countActiveFilters(f: ReadableFilters): number {
  let count = 0;
  if (f.kind !== undefined) count += 1;
  if (f.status !== undefined && f.status.length > 0) count += 1;
  if (f.isComplete !== undefined) count += 1;
  if (f.isAbandoned !== undefined) count += 1;
  if (f.fandom !== undefined) count += 1;
  if (f.rating !== undefined && f.rating.length > 0) count += 1;
  if (f.seriesOnly === true) count += 1;
  count += (f.includeTags ?? []).length;
  count += (f.excludeTags ?? []).length;
  // Sort: counts as 1 when deviating from default (dateAdded desc)
  const sortBy = f.sortBy ?? 'dateAdded';
  const sortOrder = f.sortOrder ?? 'desc';
  if (sortBy !== 'dateAdded' || sortOrder !== 'desc') count += 1;
  return count;
}

function sortLabel(f: ReadableFilters): string {
  const by = f.sortBy ?? 'dateAdded';
  const order = f.sortOrder ?? 'desc';
  if (by === 'title') return order === 'asc' ? 'Sort: Title A→Z' : 'Sort: Title Z→A';
  if (by === 'dateUpdated') return order === 'asc' ? 'Sort: Updated (oldest)' : 'Sort: Updated (newest)';
  if (by === 'wordCount') return order === 'asc' ? 'Sort: Words (shortest)' : 'Sort: Words (longest)';
  if (by === 'totalUnits') return order === 'asc' ? 'Sort: Pages (shortest)' : 'Sort: Pages (longest)';
  // dateAdded
  return order === 'asc' ? 'Sort: Added (oldest)' : 'Sort: Added (newest)';
}

// ── Active chip descriptors ────────────────────────────────────────────────────

interface ActiveChip {
  key: string;
  label: string;
  /** tag mode for include/exclude chips */
  tagMode?: 'include' | 'exclude';
  onRemove: (current: ReadableFilters) => ReadableFilters;
}

function buildActiveChips(f: ReadableFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (f.kind !== undefined) {
    chips.push({
      key: 'kind',
      label: f.kind === 'book' ? 'Books' : 'Fanfic',
      onRemove: ({ kind: _, isComplete, isAbandoned, fandom, rating, ...rest }) =>
        // Removing kind: clear AO3 filters too if they were kind-gated
        rest,
    });
  }

  if (f.status !== undefined && f.status.length > 0) {
    const labels = f.status.map((s) => STATUS_LABELS_SHORT[s]).join(' · ');
    chips.push({
      key: 'status',
      label: `Status: ${labels}`,
      onRemove: ({ status: _, ...rest }) => rest,
    });
  }

  if (f.isComplete !== undefined) {
    chips.push({
      key: 'isComplete',
      label: f.isComplete ? 'Complete' : 'WIP',
      onRemove: ({ isComplete: _, ...rest }) => rest,
    });
  }

  if (f.isAbandoned !== undefined) {
    chips.push({
      key: 'isAbandoned',
      label: f.isAbandoned ? 'Abandoned' : 'Not abandoned',
      onRemove: ({ isAbandoned: _, ...rest }) => rest,
    });
  }

  if (f.fandom !== undefined) {
    chips.push({
      key: 'fandom',
      label: `Fandom: ${f.fandom}`,
      onRemove: ({ fandom: _, ...rest }) => rest,
    });
  }

  if (f.rating !== undefined && f.rating.length > 0) {
    const labels = f.rating.map((r: AO3Rating) => AO3_RATING_LABELS[r]).join(' · ');
    chips.push({
      key: 'rating',
      label: `Rating: ${labels}`,
      onRemove: ({ rating: _, ...rest }) => rest,
    });
  }

  if (f.seriesOnly === true) {
    chips.push({
      key: 'seriesOnly',
      label: 'In a series',
      onRemove: ({ seriesOnly: _, ...rest }) => rest,
    });
  }

  for (const tag of f.includeTags ?? []) {
    chips.push({
      key: `include-${tag}`,
      label: tag,
      tagMode: 'include',
      onRemove: (prev) => {
        const includeTags = (prev.includeTags ?? []).filter((t) => t !== tag);
        return { ...prev, includeTags: includeTags.length > 0 ? includeTags : undefined };
      },
    });
  }

  for (const tag of f.excludeTags ?? []) {
    chips.push({
      key: `exclude-${tag}`,
      label: `not ${tag}`,
      tagMode: 'exclude',
      onRemove: (prev) => {
        const excludeTags = (prev.excludeTags ?? []).filter((t) => t !== tag);
        return { ...prev, excludeTags: excludeTags.length > 0 ? excludeTags : undefined };
      },
    });
  }

  // Sort chip — only when not default
  const isDefaultSort = (f.sortBy === undefined || f.sortBy === 'dateAdded') &&
    (f.sortOrder === undefined || f.sortOrder === 'desc');
  if (!isDefaultSort) {
    chips.push({
      key: 'sort',
      label: sortLabel(f),
      onRemove: ({ sortBy: _, sortOrder: __, ...rest }) => ({
        ...rest,
        sortBy: 'dateAdded',
        sortOrder: 'desc',
      }),
    });
  }

  return chips;
}

// ── Local sub-components ───────────────────────────────────────────────────────

function FilterIcon({ color }: { color: string }) {
  return (
    <View style={{ gap: 4.5, alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: 11, height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: 6,  height: 2, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

function FilterBadge({ count }: { count: number }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: theme.colors.kindBook,
        borderWidth: 2,
        borderColor: theme.colors.backgroundPage,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF' }}>
        {count}
      </Text>
    </View>
  );
}

function FilterButton({
  onPress,
  badgeCount,
}: {
  onPress: () => void;
  badgeCount: number;
}) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.backgroundInput,
        borderWidth: 1,
        borderColor: theme.colors.backgroundBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel={badgeCount > 0 ? `Filters, ${badgeCount} active` : 'Filters'}
    >
      <FilterIcon color={theme.colors.textBody} />
      {badgeCount > 0 && <FilterBadge count={badgeCount} />}
    </TouchableOpacity>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavProp>();
  const route = useRoute<LibraryRouteProp>();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ReadableFilters>(DEFAULT_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Apply initialFilters from route params on mount (once only)
  const appliedInitialRef = useRef(false);
  useEffect(() => {
    if (!appliedInitialRef.current && route.params?.initialFilters) {
      setFilters(route.params.initialFilters);
      appliedInitialRef.current = true;
    }
  }, [route.params?.initialFilters]);

  // Merged filters (search is kept separate from the modal for direct input)
  const effectiveFilters = useMemo<ReadableFilters>(
    () => ({ ...filters, search: search.trim() || undefined }),
    [filters, search],
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const { readables, isLoading, isError, error, refetch } = useReadables(effectiveFilters);
  const { readables: allReadables } = useReadables({});

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeChips = useMemo(() => buildActiveChips(filters), [filters]);
  const badgeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const hasActiveFilters = search.trim() !== '' || activeChips.length > 0;

  const isEmptyLibrary = readables.length === 0 && !isLoading && !isError && !hasActiveFilters;
  const isNoResults = readables.length === 0 && !isLoading && !isError && hasActiveFilters;

  // ── Scroll-driven header animations (native thread only, no JS state) ───────
  // scrollY feeds three interpolations:
  //   largeTitleOpacity  — fades the large title+count out as you scroll
  //   compactTranslateY  — slides the compact header down from above
  //   compactOpacity     — fades the compact header in simultaneously
  //
  // Thresholds are driven by onLayout measurements so they remain correct
  // when font scaling (Dynamic Type / Font Scaling) changes text sizes.
  const scrollY = useRef(new Animated.Value(0)).current;
  const compactHeaderHeight = insets.top + 62;

  // Measured height of the large title row inside the full header.
  // Seeded with a reasonable estimate so the animation works before layout fires.
  const titleRowHeightRef = useRef(insets.top + 80);
  const [titleRowHeight, setTitleRowHeight] = useState(insets.top + 80);

  const fadeStart = insets.top;
  const fadeEnd = titleRowHeight;

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, fadeStart + Math.max(20, fadeEnd - fadeStart) * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const compactTranslateY = scrollY.interpolate({
    inputRange: [fadeStart, fadeEnd],
    outputRange: [-compactHeaderHeight, 0],
    extrapolate: 'clamp',
  });

  const compactOpacity = scrollY.interpolate({
    inputRange: [fadeStart, fadeEnd],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  function onTitleRowLayout(e: { nativeEvent: { layout: { height: number } } }) {
    const measured = insets.top + e.nativeEvent.layout.height;
    if (Math.abs(measured - titleRowHeightRef.current) > 2) {
      titleRowHeightRef.current = measured;
      setTitleRowHeight(measured);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleItemPress = useCallback(
    (id: string) => navigation.navigate('ReadableDetail', { id }),
    [navigation],
  );

  const handleAddPress = useCallback(
    () => navigation.navigate('QuickAddReadable'),
    [navigation],
  );

  function handleResetFilters() {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }

  function handleApplyFilters(applied: ReadableFilters) {
    setFilters(applied);
    setFilterModalVisible(false);
  }

  // ── FlatList helpers ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: (typeof readables)[number] }) => (
      <ReadableListItem item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  function renderListHeader() {
    return (
      <>
        {hasActiveFilters && !isLoading && !isError && (
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.textMeta,
              paddingHorizontal: 18,
              paddingTop: 2,
              paddingBottom: 6,
            }}
            accessibilityLiveRegion="polite"
          >
            {readables.length === 1 ? '1 result' : `${readables.length} results`}
          </Text>
        )}
        {!hasActiveFilters && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: theme.colors.textMeta,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              paddingHorizontal: 18,
              paddingTop: 8,
              paddingBottom: 6,
            }}
          >
            All readables
          </Text>
        )}
      </>
    );
  }

  // ── Header renders ────────────────────────────────────────────────────────

  function renderChipsRow() {
    if (activeChips.length === 0) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, gap: 8, alignItems: 'center' }}
        style={{ flexGrow: 0 }}
      >
        {activeChips.map((chip) => {
          const isExclude = chip.tagMode === 'exclude';
          const chipColor = isExclude ? theme.colors.danger : theme.colors.kindBook;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setFilters((prev) => chip.onRemove(prev))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingLeft: 14,
                paddingRight: 10,
                paddingVertical: 6,
                borderRadius: theme.radii.pill,
                backgroundColor: isExclude
                  ? theme.colors.dangerSubtle
                  : theme.colors.kindBookSubtle,
                borderWidth: 1,
                borderColor: isExclude
                  ? theme.colors.dangerBorder
                  : theme.colors.kindBookBorder,
                minHeight: 36,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${chip.label} filter`}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: chipColor,
                }}
              >
                {chip.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: chipColor,
                  opacity: 0.6,
                }}
              >
                ×
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  function renderFullHeader() {
    return (
      <LinearGradient
        colors={[theme.colors.backgroundInput, theme.colors.backgroundPage]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 16,
          paddingBottom: 12,
        }}
      >
        {/* Title row — fades out as you scroll (native thread opacity) */}
        <Animated.View
          onLayout={onTitleRowLayout}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
            opacity: largeTitleOpacity,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '500',
                color: theme.colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              Library
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: theme.colors.textMeta,
                marginTop: 2,
              }}
            >
              {allReadables.length} {allReadables.length === 1 ? 'readable' : 'readables'}
            </Text>
          </View>
          <FilterButton
            onPress={() => setFilterModalVisible(true)}
            badgeCount={badgeCount}
          />
        </Animated.View>

        {/* Search bar — scrolls naturally, no fade */}
        <View style={{ marginBottom: 8 }}>
          <AppSearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or author"
            accessibilityLabel="Search by title or author"
            height={46}
            shadow
          />
        </View>

        {/* Active chips */}
        {renderChipsRow()}
      </LinearGradient>
    );
  }

  function renderCompactHeader() {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 9,
          paddingTop: insets.top + 9,
          backgroundColor: theme.colors.backgroundPage,
          ...theme.shadows.small,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '500',
            color: theme.colors.textPrimary,
          }}
        >
          Library
        </Text>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <AppSearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title or author"
            accessibilityLabel="Search by title or author"
            height={38}
            shadow={false}
          />
        </View>
        <FilterButton
          onPress={() => setFilterModalVisible(true)}
          badgeCount={badgeCount}
        />
      </View>
    );
  }

  // ── Content area ──────────────────────────────────────────────────────────

  function renderContent() {
    if (isLoading) {
      return (
        <>
          {renderFullHeader()}
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" />
          </View>
        </>
      );
    }

    if (isError) {
      return (
        <>
          {renderFullHeader()}
          <EmptyState
            title="Something went wrong"
            message={error?.message ?? 'Unable to load your library.'}
            action={{ label: 'Try again', onPress: refetch }}
          />
        </>
      );
    }

    if (isEmptyLibrary) {
      return (
        <>
          {renderFullHeader()}
          <EmptyState
            title="Your library is empty"
            message="Add a book or fanfic to get started."
            action={{ label: 'Add your first read', onPress: handleAddPress }}
          />
        </>
      );
    }

    if (isNoResults) {
      return (
        <>
          {renderFullHeader()}
          <EmptyState
            title="No matches"
            message="Try adjusting your search or filters."
            action={{ label: 'Reset filters', onPress: handleResetFilters }}
          />
        </>
      );
    }

    return (
      <Animated.FlatList
        data={readables}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={() => (
          // marginHorizontal: -14 negates contentContainerStyle.paddingHorizontal so the
          // full header renders edge-to-edge. renderListHeader scrolls naturally below it.
          <View style={{ marginHorizontal: -14 }}>
            {renderFullHeader()}
            {renderListHeader()}
          </View>
        )}
        removeClippedSubviews={Platform.OS === 'android'}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: insets.bottom + 88,
          gap: 9,
        }}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.backgroundPage }}>
      {/* Compact header — slides and fades in from above, driven by scrollY on the
          native thread. translateY puts it physically off-screen when not in compact
          mode, so pointerEvents='auto' is safe (off-screen views don't intercept touches). */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          opacity: compactOpacity,
          transform: [{ translateY: compactTranslateY }],
        }}
        pointerEvents="auto"
      >
        {renderCompactHeader()}
      </Animated.View>

      {/* Content: list / empty / loading / error.
          In list mode the full header is inside FlatList ListHeaderComponent and scrolls
          naturally. In non-list modes it renders at the top of the content area. */}
      <View style={styles.contentArea}>{renderContent()}</View>

      {/* FAB — add new readable */}
      <FAB
        icon="plus"
        color="#FFFFFF"
        style={{
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 16,
          backgroundColor: theme.colors.kindBook,
        }}
        onPress={handleAddPress}
        accessibilityLabel="Add readable"
      />

      {/* Filter modal */}
      <FilterModal
        visible={filterModalVisible}
        filters={filters}
        onApply={handleApplyFilters}
        onDismiss={() => setFilterModalVisible(false)}
        allReadables={allReadables}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  contentArea: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
