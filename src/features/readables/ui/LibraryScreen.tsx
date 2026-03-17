// src/features/readables/ui/LibraryScreen.tsx
// v2 Phase 6 — Library screen with filter modal, active filter chips, and badge count.
//
// Layout (top to bottom):
//   Searchbar (with filter icon button + badge in header)
//   → Active filter chips row (horizontal scroll, one chip per active filter)
//   → Content area
//   → FAB
//
// Filter state is a single ReadableFilters object — local, resets on remount.
// Initialized from route.params.initialFilters on mount (if provided).
// The filter modal operates on a draft copy; only commits on Apply.
//
// countActiveFilters and getFilterChipLabel are module-level pure functions.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Badge,
  Chip,
  FAB,
  IconButton,
  Searchbar,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList, TabParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
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
  // Filtered list for display
  const { readables, isLoading, isError, error, refetch } = useReadables(effectiveFilters);
  // Unfiltered full list — passed to FilterModal for live count
  const { readables: allReadables } = useReadables({});

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeChips = useMemo(() => buildActiveChips(filters), [filters]);
  const badgeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const hasActiveFilters =
    search.trim() !== '' || activeChips.length > 0;

  const isEmptyLibrary = readables.length === 0 && !isLoading && !isError && !hasActiveFilters;
  const isNoResults = readables.length === 0 && !isLoading && !isError && hasActiveFilters;

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

  // ── Header filter button ─────────────────────────────────────────────────

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <IconButton
            icon="filter-variant"
            size={24}
            onPress={() => setFilterModalVisible(true)}
            accessibilityLabel={
              badgeCount > 0 ? `Filters (${badgeCount} active)` : 'Open filters'
            }
          />
          {badgeCount > 0 && (
            <Badge style={styles.badge} size={16}>
              {badgeCount}
            </Badge>
          )}
        </View>
      ),
    });
  }, [navigation, badgeCount]);

  // ── FlatList helpers ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: (typeof readables)[number] }) => (
      <ReadableListItem item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const renderSeparator = useCallback(
    () => (
      <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />
    ),
    [theme.colors.outlineVariant],
  );

  // ── Content area ──────────────────────────────────────────────────────────

  function renderContent() {
    if (isLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (isError) {
      return (
        <EmptyState
          title="Something went wrong"
          message={error?.message ?? 'Unable to load your library.'}
          action={{ label: 'Try again', onPress: refetch }}
        />
      );
    }

    if (isEmptyLibrary) {
      return (
        <EmptyState
          title="Your library is empty"
          message="Add a book or fanfic to get started."
          action={{ label: 'Add your first read', onPress: handleAddPress }}
        />
      );
    }

    if (isNoResults) {
      return (
        <EmptyState
          title="No matches"
          message="Try adjusting your search or filters."
          action={{ label: 'Reset filters', onPress: handleResetFilters }}
        />
      );
    }

    return (
      <FlatList
        data={readables}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search */}
      <Searchbar
        placeholder="Search by title or author"
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
      />

      {/* Active filter chips — horizontal scroll */}
      {activeChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              onClose={() => setFilters((prev) => chip.onRemove(prev))}
              style={[
                styles.chip,
                chip.tagMode === 'include' && { backgroundColor: theme.colors.primaryContainer },
                chip.tagMode === 'exclude' && { backgroundColor: theme.colors.errorContainer },
              ]}
              compact
              accessibilityLabel={`Active filter: ${chip.label}. Tap × to remove.`}
            >
              {chip.label}
            </Chip>
          ))}
        </ScrollView>
      )}

      {/* Result count when filters are active */}
      {hasActiveFilters && !isLoading && !isError && (
        <Text
          variant="labelSmall"
          style={[styles.resultCount, { color: theme.colors.textSecondary }]}
        >
          {readables.length === 1 ? '1 result' : `${readables.length} results`}
        </Text>
      )}

      {/* Content: list / empty / loading / error */}
      <View style={styles.contentArea}>{renderContent()}</View>

      {/* FAB — add new readable */}
      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
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
  container: {
    flex: 1,
    paddingTop: 16,
  },
  headerRightContainer: {
    position: 'relative',
    marginRight: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    // Compact chips — Paper handles sizing
  },
  resultCount: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  contentArea: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    // No extra padding — items provide their own
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
  },
});
