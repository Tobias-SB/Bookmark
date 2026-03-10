// src/features/readables/ui/LibraryScreen.tsx
// §8 — Fully functional library screen.
//
// Layout (top to bottom):
//   Searchbar → Filter chip row (horizontal scroll) → Sort selector → Content area → FAB
//
// Content area states:
//   isLoading  → ActivityIndicator
//   isError    → EmptyState with retry action
//   empty lib  → EmptyState with "Add your first read" CTA
//   no results → EmptyState with "Reset filters" action
//   has data   → FlatList of ReadableListItem
//
// Filter state is local — resets on screen remount (not persisted, per §8).
//
// PROVISIONAL: When sortBy changes, sortOrder is auto-set (title → asc,
// dates → desc). This is not specified in the reference doc but avoids
// Z→A as the default title sort. Confirm or override if needed.

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  FAB,
  Searchbar,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { EmptyState } from '../../../shared/components/EmptyState';
import type { ReadableFilters, ReadableStatus } from '../domain/readable';
import { READABLE_STATUSES } from '../domain/readable';
import { useReadables } from '../hooks/useReadables';
import { ReadableListItem } from './ReadableListItem';

// ── Types + constants ─────────────────────────────────────────────────────────

type LibraryNavProp = NativeStackNavigationProp<RootStackParamList>;
type SortByOption = NonNullable<ReadableFilters['sortBy']>;
type SortOrderOption = NonNullable<ReadableFilters['sortOrder']>;

const STATUS_CHIP_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  completed: 'Completed',
  dnf: 'DNF',
};

const SORT_BUTTONS: { value: SortByOption; label: string }[] = [
  { value: 'dateAdded', label: 'Added' },
  { value: 'title', label: 'Title' },
  { value: 'dateUpdated', label: 'Updated' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryScreen() {
  const navigation = useNavigation<LibraryNavProp>();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  // ── Filter state — local; resets on remount ────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadableStatus | undefined>(undefined);
  const [isCompleteFilter, setIsCompleteFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortByOption>('dateAdded');
  const [sortOrder, setSortOrder] = useState<SortOrderOption>('desc');

  const filters = useMemo<ReadableFilters>(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter,
      isComplete: isCompleteFilter,
      sortBy,
      sortOrder,
    }),
    [search, statusFilter, isCompleteFilter, sortBy, sortOrder],
  );

  const { readables, isLoading, isError, error, refetch } = useReadables(filters);

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== undefined ||
    isCompleteFilter !== undefined;

  const isEmptyLibrary = readables.length === 0 && !isLoading && !isError && !hasActiveFilters;
  const isNoResults = readables.length === 0 && !isLoading && !isError && hasActiveFilters;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleItemPress = useCallback(
    (id: string) => navigation.navigate('ReadableDetail', { id }),
    [navigation],
  );

  const handleAddPress = useCallback(
    () => navigation.navigate('AddEditReadable', {}),
    [navigation],
  );

  function handleSortByChange(newSortBy: SortByOption) {
    setSortBy(newSortBy);
    // PROVISIONAL: auto-set order so title sorts A→Z and dates sort newest-first.
    setSortOrder(newSortBy === 'title' ? 'asc' : 'desc');
  }

  function handleStatusChipPress(status: ReadableStatus | undefined) {
    // Tapping the active chip deselects it; tapping another selects it.
    setStatusFilter((prev) => (prev === status ? undefined : status));
  }

  function handleIsCompleteChipPress(value: boolean) {
    setIsCompleteFilter((prev) => (prev === value ? undefined : value));
  }

  function handleResetFilters() {
    setSearch('');
    setStatusFilter(undefined);
    setIsCompleteFilter(undefined);
  }

  // ── FlatList helpers ───────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: (typeof readables)[number] }) => (
      <ReadableListItem item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const renderSeparator = useCallback(
    () => (
      <View
        style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]}
      />
    ),
    [theme.colors.outlineVariant],
  );

  // ── Content area ───────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search */}
      <Searchbar
        placeholder="Search by title or author"
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
      />

      {/* Filter chips — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {/* Status chips: "All" + 4 statuses */}
        <Chip
          selected={statusFilter === undefined}
          onPress={() => handleStatusChipPress(undefined)}
          style={styles.chip}
          compact
        >
          All
        </Chip>
        {READABLE_STATUSES.map((status) => (
          <Chip
            key={status}
            selected={statusFilter === status}
            onPress={() => handleStatusChipPress(status)}
            style={styles.chip}
            compact
          >
            {STATUS_CHIP_LABELS[status]}
          </Chip>
        ))}

        {/* Visual divider between status and WIP/Complete chips */}
        <View
          style={[styles.chipGroupDivider, { backgroundColor: theme.colors.outlineVariant }]}
        />

        {/* WIP / Complete — AO3 only; books (isComplete = null) never match */}
        <Chip
          selected={isCompleteFilter === false}
          onPress={() => handleIsCompleteChipPress(false)}
          style={styles.chip}
          compact
        >
          WIP
        </Chip>
        <Chip
          selected={isCompleteFilter === true}
          onPress={() => handleIsCompleteChipPress(true)}
          style={styles.chip}
          compact
        >
          Complete
        </Chip>
      </ScrollView>

      {/* Sort selector */}
      <View style={styles.sortRow}>
        <Text variant="labelSmall" style={{ color: theme.colors.textSecondary }}>
          Sort by
        </Text>
        <SegmentedButtons
          value={sortBy}
          onValueChange={(v) => handleSortByChange(v as SortByOption)}
          buttons={SORT_BUTTONS}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Content: list / empty / loading / error */}
      <View style={styles.contentArea}>{renderContent()}</View>

      {/* FAB — add new readable */}
      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={handleAddPress}
        accessibilityLabel="Add readable"
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
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    // Compact chips — Paper handles sizing via the `compact` prop
  },
  chipGroupDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    flex: 1,
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
    // No extra padding — items provide their own paddingHorizontal/Vertical
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
