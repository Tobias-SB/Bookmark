// src/features/readables/components/LibraryFilterBar.tsx
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Button,
  Menu,
  Searchbar,
  Text,
  useTheme,
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';

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

const TYPE_FILTERS: { value?: ReadableType; label: string }[] = [
  { value: undefined, label: 'All types' },
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

  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [priorityMenuVisible, setPriorityMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  const handleStatusChange = (status: LibraryFilter) => {
    onQueryChange({
      ...query,
      status,
    });
    setStatusMenuVisible(false);
  };

  const handleTypeChange = (type: ReadableType | undefined) => {
    onQueryChange({
      ...query,
      type,
    });
    setTypeMenuVisible(false);
  };

  const handlePriorityChange = (priority: number | undefined) => {
    if (priority == null) {
      onQueryChange({
        ...query,
        minPriority: undefined,
        maxPriority: undefined,
      });
    } else {
      onQueryChange({
        ...query,
        minPriority: priority,
        maxPriority: priority,
      });
    }
    setPriorityMenuVisible(false);
  };

  const handleSortChange = (field: LibrarySortField) => {
    let direction = query.sort.direction;

    if (query.sort.field === field) {
      // On repeated selection, flip direction
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
    setSortMenuVisible(false);
  };

  const handleClearAllFilters = () => {
    onQueryChange({
      status: 'all',
      type: undefined,
      minPriority: undefined,
      maxPriority: undefined,
      searchQuery: null,
      sort: {
        field: 'createdAt',
        direction: 'desc',
      },
    });
  };

  const statusLabel = labelForStatus(query.status);
  const typeLabel = (() => {
    if (!query.type) return 'All types';
    return query.type === 'book' ? 'Books' : 'Fanfic';
  })();
  const priorityLabel = (() => {
    if (query.minPriority == null || query.maxPriority == null) return 'Any priority';
    if (query.minPriority === query.maxPriority) {
      return `Priority ${query.minPriority}`;
    }
    return `Priority ${query.minPriority}–${query.maxPriority}`;
  })();
  const sortLabel = (() => {
    const base = SORT_CONFIG.find((s) => s.value === query.sort.field)?.label ?? 'Sort';
    const dirArrow = query.sort.direction === 'asc' ? '↑' : '↓';
    return `${base} ${dirArrow}`;
  })();

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

      <View style={styles.filtersHeaderRow}>
        <Text variant="labelSmall" style={styles.filtersLabel}>
          Filters
        </Text>
        <View style={styles.filtersHeaderRight}>
          <Button mode="text" onPress={handleClearAllFilters} compact icon="filter-off-outline">
            Clear
          </Button>
          <IconButton
            icon={filtersCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            onPress={() => setFiltersCollapsed((prev) => !prev)}
            accessibilityLabel={filtersCollapsed ? 'Show filters' : 'Hide filters'}
          />
        </View>
      </View>

      {!filtersCollapsed && (
        <>
          <View style={styles.menuRow}>
            {/* Status */}
            <Menu
              visible={statusMenuVisible}
              onDismiss={() => setStatusMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setStatusMenuVisible(true)}
                  style={styles.menuButton}
                  icon="tune-vertical"
                >
                  Status: {statusLabel}
                </Button>
              }
            >
              {STATUS_FILTERS.map((status) => (
                <Menu.Item
                  key={status}
                  onPress={() => handleStatusChange(status)}
                  title={labelForStatus(status)}
                />
              ))}
            </Menu>

            {/* Type */}
            <Menu
              visible={typeMenuVisible}
              onDismiss={() => setTypeMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setTypeMenuVisible(true)}
                  style={styles.menuButton}
                  icon="book-open-variant"
                >
                  Type: {typeLabel}
                </Button>
              }
            >
              {TYPE_FILTERS.map((option) => (
                <Menu.Item
                  key={option.label}
                  onPress={() => handleTypeChange(option.value)}
                  title={option.label}
                />
              ))}
            </Menu>
          </View>

          <View style={styles.menuRow}>
            {/* Priority */}
            <Menu
              visible={priorityMenuVisible}
              onDismiss={() => setPriorityMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setPriorityMenuVisible(true)}
                  style={styles.menuButton}
                  icon="star-outline"
                >
                  {priorityLabel}
                </Button>
              }
            >
              <Menu.Item onPress={() => handlePriorityChange(undefined)} title="Any priority" />
              {PRIORITY_VALUES.map((value) => (
                <Menu.Item
                  key={value}
                  onPress={() => handlePriorityChange(value)}
                  title={`Priority ${value}`}
                />
              ))}
            </Menu>

            {/* Sort */}
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setSortMenuVisible(true)}
                  style={styles.menuButton}
                  icon="sort"
                >
                  {sortLabel}
                </Button>
              }
            >
              {SORT_CONFIG.map((config) => (
                <Menu.Item
                  key={config.value}
                  onPress={() => handleSortChange(config.value)}
                  title={config.label}
                />
              ))}
            </Menu>
          </View>

          {/* Optional: small hint row */}
          <View style={styles.sortHintRow}>
            <Text variant="labelSmall" style={styles.sortHintText}>
              Tip: selecting the same sort again toggles ascending/descending.
            </Text>
          </View>
        </>
      )}
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
  tagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  filtersLabel: {
    opacity: 0.8,
  },
  filtersHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  menuButton: {
    flex: 1,
    marginRight: 8,
  },
  sortHintRow: {
    marginTop: 2,
  },
  sortHintText: {
    opacity: 0.6,
    fontSize: 11,
  },
});

export default LibraryFilterBar;
