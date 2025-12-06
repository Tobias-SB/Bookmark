// src/features/readables/components/LibraryFilterBar.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  RadioButton,
  Searchbar,
  Text,
  useTheme,
  IconButton,
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
  { value: 'progressPercent', label: 'Progress' }, // NEW
];

const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({
  query,
  onQueryChange,
  activeTagLabel,
}) => {
  const theme = useTheme();

  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [typeDialogVisible, setTypeDialogVisible] = useState(false);
  const [priorityDialogVisible, setPriorityDialogVisible] = useState(false);
  const [sortDialogVisible, setSortDialogVisible] = useState(false);

  const handleStatusChange = (status: LibraryFilter) => {
    onQueryChange({
      ...query,
      status,
    });
    setStatusDialogVisible(false);
  };

  const handleTypeChange = (typeValue: string) => {
    const type = typeValue === 'all' ? undefined : (typeValue as ReadableType);
    onQueryChange({
      ...query,
      type,
    });
    setTypeDialogVisible(false);
  };

  const handlePriorityChange = (value: string) => {
    if (value === 'any') {
      onQueryChange({
        ...query,
        minPriority: undefined,
        maxPriority: undefined,
      });
    } else {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        onQueryChange({
          ...query,
          minPriority: num,
          maxPriority: num,
        });
      }
    }
    setPriorityDialogVisible(false);
  };

  const handleSortFieldChange = (field: LibrarySortField) => {
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
        case 'progressPercent':
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
    setSortDialogVisible(false);
  };

  const toggleSortDirection = () => {
    const nextDirection = query.sort.direction === 'asc' ? 'desc' : 'asc';
    onQueryChange({
      ...query,
      sort: {
        ...query.sort,
        direction: nextDirection,
      },
    });
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
  const sortFieldLabel = SORT_CONFIG.find((s) => s.value === query.sort.field)?.label ?? 'Sort';
  const sortDirectionIcon = query.sort.direction === 'asc' ? 'arrow-up' : 'arrow-down';

  const toggleFiltersCollapsed = () => {
    setFiltersCollapsed((prev) => !prev);
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

      {/* Header row: Filters chip + (when open) Clear filters */}
      <View style={styles.headerRow}>
        <Pressable
          style={[
            styles.filtersChip,
            {
              backgroundColor: theme.colors.secondaryContainer,
            },
          ]}
          onPress={toggleFiltersCollapsed}
        >
          <IconButton
            icon="filter-variant"
            size={16}
            iconColor={theme.colors.primary}
            style={styles.filtersChipIcon}
          />
          <Text
            variant="labelMedium"
            style={[styles.filtersLabel, { color: theme.colors.primary }]}
          >
            Filters
          </Text>
          <IconButton
            icon={filtersCollapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            iconColor={theme.colors.primary}
            style={styles.filtersChipIcon}
          />
        </Pressable>

        {!filtersCollapsed && (
          <Button mode="text" onPress={handleClearAllFilters} compact icon="filter-off-outline">
            Clear filters
          </Button>
        )}
      </View>

      {!filtersCollapsed && (
        <>
          <View style={styles.menuRow}>
            <FilterButton
              icon="tune-vertical"
              label={`Status: ${statusLabel}`}
              onPress={() => setStatusDialogVisible(true)}
              themeOutlineColor={theme.colors.outline}
              style={styles.menuButton}
            />
            <FilterButton
              icon="book-open-variant"
              label={`Type: ${typeLabel}`}
              onPress={() => setTypeDialogVisible(true)}
              themeOutlineColor={theme.colors.outline}
              style={styles.menuButton}
            />
          </View>

          <View style={styles.menuRow}>
            <FilterButton
              icon="star-outline"
              label={priorityLabel}
              onPress={() => setPriorityDialogVisible(true)}
              themeOutlineColor={theme.colors.outline}
              style={styles.menuButton}
            />

            <FilterButton
              icon="sort"
              label={sortFieldLabel}
              onPress={() => setSortDialogVisible(true)}
              rightIconName={sortDirectionIcon}
              onRightIconPress={toggleSortDirection}
              themeOutlineColor={theme.colors.outline}
              style={styles.menuButton}
            />
          </View>

          <View style={styles.sortHintRow}>
            <Text variant="labelSmall" style={styles.sortHintText}>
              Tap the label to change sort field, arrow to flip direction.
            </Text>
          </View>
        </>
      )}

      {/* Separator line between controls and list */}
      <View
        style={[
          styles.separator,
          { backgroundColor: theme.colors.outlineVariant ?? theme.colors.outline },
        ]}
      />

      {/* Dialogs */}
      <Portal>
        {/* Status dialog */}
        <Dialog visible={statusDialogVisible} onDismiss={() => setStatusDialogVisible(false)}>
          <Dialog.Title>Status filter</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => handleStatusChange(value as LibraryFilter)}
              value={query.status}
            >
              {STATUS_FILTERS.map((status) => (
                <RadioButton.Item key={status} label={labelForStatus(status)} value={status} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStatusDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Type dialog */}
        <Dialog visible={typeDialogVisible} onDismiss={() => setTypeDialogVisible(false)}>
          <Dialog.Title>Type filter</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group onValueChange={handleTypeChange} value={query.type ?? 'all'}>
              <RadioButton.Item label="All types" value="all" />
              <RadioButton.Item label="Books" value="book" />
              <RadioButton.Item label="Fanfic" value="fanfic" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTypeDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Priority dialog */}
        <Dialog visible={priorityDialogVisible} onDismiss={() => setPriorityDialogVisible(false)}>
          <Dialog.Title>Priority filter</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={handlePriorityChange}
              value={
                query.minPriority != null && query.maxPriority != null
                  ? String(query.minPriority)
                  : 'any'
              }
            >
              <RadioButton.Item label="Any priority" value="any" />
              {PRIORITY_VALUES.map((value) => (
                <RadioButton.Item key={value} label={`Priority ${value}`} value={String(value)} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPriorityDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Sort dialog */}
        <Dialog visible={sortDialogVisible} onDismiss={() => setSortDialogVisible(false)}>
          <Dialog.Title>Sort by</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => handleSortFieldChange(value as LibrarySortField)}
              value={query.sort.field}
            >
              {SORT_CONFIG.map((config) => (
                <RadioButton.Item key={config.value} label={config.label} value={config.value} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSortDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

/**
 * Shared outlined filter button so all filters (status/type/priority/sort)
 * look and size the same.
 */
interface FilterButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  rightIconName?: string;
  onRightIconPress?: () => void;
  themeOutlineColor: string;
  style?: any;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  icon,
  label,
  onPress,
  rightIconName,
  onRightIconPress,
  themeOutlineColor,
  style,
}) => {
  return (
    <View style={[styles.filterButtonContainer, style, { borderColor: themeOutlineColor }]}>
      <Pressable style={styles.filterButtonMain} onPress={onPress}>
        <IconButton icon={icon} size={16} style={styles.filterButtonIcon} />
        <Text variant="labelMedium" style={styles.filterButtonText}>
          {label}
        </Text>
      </Pressable>
      {rightIconName && (
        <Pressable style={styles.filterButtonRight} onPress={onRightIconPress ?? onPress}>
          <IconButton icon={rightIconName} size={16} style={styles.filterButtonRightIcon} />
        </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'space-between',
  },
  filtersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  filtersChipIcon: {
    margin: 0,
  },
  filtersLabel: {
    marginHorizontal: 2,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
  },

  // FilterButton styles
  filterButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    overflow: 'hidden',
  },
  filterButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    flex: 1,
  },
  filterButtonIcon: {
    margin: 0,
    marginRight: 4,
  },
  filterButtonText: {
    fontSize: 13,
  },
  filterButtonRight: {
    paddingRight: 2,
  },
  filterButtonRightIcon: {
    margin: 0,
  },
});

export default LibraryFilterBar;
