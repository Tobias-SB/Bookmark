// src/features/readables/components/LibraryFilterBar.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Chip, Searchbar, Text, useTheme, IconButton, SegmentedButtons } from 'react-native-paper';

import type { LibraryFilter, ReadableType } from '../types';
import type { LibraryQueryParams, LibrarySortField } from '../types/libraryQuery';

export interface LibraryFilterBarProps {
  query: LibraryQueryParams;
  onQueryChange: (next: LibraryQueryParams) => void;
  /**
   * Optional label to show when we arrived here from a tag tap,
   * e.g. "Filtered by tag: Found Family"
   */
  activeTagLabel?: string | null;
}

const STATUS_FILTERS: LibraryFilter[] = ['all', 'to-read', 'reading', 'finished', 'DNF'];

const TYPE_FILTERS: { value: ReadableType; label: string }[] = [
  { value: 'book', label: 'Books' },
  { value: 'fanfic', label: 'Fanfic' },
];

const PRIORITY_VALUES = [1, 2, 3, 4, 5];

const SORT_CONFIG: { value: LibrarySortField; label: string }[] = [
  { value: 'createdAt', label: 'Latest' },
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'priority', label: 'Priority' },
];

const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({
  query,
  onQueryChange,
  activeTagLabel,
}) => {
  const theme = useTheme();

  const handleStatusChange = (status: LibraryFilter) => {
    onQueryChange({
      ...query,
      status,
    });
  };

  const handleToggleType = (type: ReadableType) => {
    const current = query.types ?? [];
    const exists = current.includes(type);
    const next = exists ? current.filter((t) => t !== type) : [...current, type];

    onQueryChange({
      ...query,
      types: next.length === 0 ? undefined : next,
    });
  };

  const handlePriorityChange = (priority: number) => {
    const { minPriority, maxPriority } = query;

    // Simple UX: tapping the same number again clears the priority filter
    if (minPriority === priority && maxPriority === priority) {
      onQueryChange({
        ...query,
        minPriority: undefined,
        maxPriority: undefined,
      });
      return;
    }

    onQueryChange({
      ...query,
      minPriority: priority,
      maxPriority: priority,
    });
  };

  const handleSortChange = (field: LibrarySortField) => {
    let direction = query.sort.direction;

    if (query.sort.field === field) {
      // On repeated tap, flip direction
      direction = direction === 'asc' ? 'desc' : 'asc';
    } else {
      // Defaults per field
      switch (field) {
        case 'createdAt':
        case 'updatedAt':
        case 'priority':
          direction = 'desc';
          break;
        case 'title':
        case 'author':
        default:
          direction = 'asc';
      }
    }

    onQueryChange({
      ...query,
      sort: { field, direction },
    });
  };

  const handleClearAllFilters = () => {
    onQueryChange({
      status: 'all',
      types: undefined,
      minPriority: undefined,
      maxPriority: undefined,
      searchQuery: null,
      sort: {
        field: 'createdAt',
        direction: 'desc',
      },
    });
  };

  return (
    <View style={styles.container}>
      {activeTagLabel ? (
        <View style={styles.tagBanner}>
          <Text variant="labelMedium">
            Filtered by tag:{' '}
            <Text style={{ color: theme.colors.primary }} variant="labelMedium">
              {activeTagLabel}
            </Text>
          </Text>
          <IconButton
            icon="close"
            size={18}
            onPress={handleClearAllFilters}
            accessibilityLabel="Clear tag filter"
          />
        </View>
      ) : null}

      <Searchbar
        placeholder="Search library…"
        value={query.searchQuery ?? ''}
        onChangeText={(text) => {
          onQueryChange({
            ...query,
            searchQuery: text.length ? text : null,
          });
        }}
        style={styles.searchbar}
      />

      <View style={styles.section}>
        <Text variant="labelSmall" style={styles.sectionLabel}>
          Status
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {STATUS_FILTERS.map((status) => (
              <Chip
                key={status}
                selected={query.status === status}
                onPress={() => handleStatusChange(status)}
                style={styles.chip}
              >
                {labelForStatus(status)}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text variant="labelSmall" style={styles.sectionLabel}>
          Type
        </Text>
        <View style={styles.chipRow}>
          {TYPE_FILTERS.map((t) => (
            <Chip
              key={t.value}
              selected={query.types?.includes(t.value) ?? false}
              onPress={() => handleToggleType(t.value)}
              style={styles.chip}
            >
              {t.label}
            </Chip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="labelSmall" style={styles.sectionLabel}>
          Priority
        </Text>
        <View style={styles.chipRow}>
          {PRIORITY_VALUES.map((value) => {
            const selected = query.minPriority === value && query.maxPriority === value;

            return (
              <Chip
                key={value}
                selected={selected}
                onPress={() => handlePriorityChange(value)}
                style={styles.chip}
              >
                {value}
              </Chip>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="labelSmall" style={styles.sectionLabel}>
          Sort by
        </Text>
        <SegmentedButtons
          value={query.sort.field}
          onValueChange={(value) => handleSortChange(value as LibrarySortField)}
          buttons={SORT_CONFIG.map((config) => ({
            value: config.value,
            label: config.label,
          }))}
          style={styles.sortButtons}
        />
      </View>

      <View style={styles.clearRow}>
        <IconButton
          icon="filter-off-outline"
          size={20}
          onPress={handleClearAllFilters}
          accessibilityLabel="Clear filters"
        />
        <Text variant="labelSmall">Clear all filters</Text>
      </View>
    </View>
  );
};

function labelForStatus(status: LibraryFilter): string {
  switch (status) {
    case 'all':
      return 'All';
    case 'to-read':
      return 'To read';
    case 'reading':
      return 'Reading';
    case 'finished':
      return 'Finished';
    case 'DNF':
      return 'Did not finish';
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  searchbar: {
    marginBottom: 4,
  },
  section: {
    marginTop: 4,
  },
  sectionLabel: {
    marginBottom: 4,
    opacity: 0.7,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    marginRight: 4,
    marginVertical: 2,
  },
  sortButtons: {
    marginTop: 4,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default LibraryFilterBar;
