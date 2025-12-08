// src/features/readables/components/LibraryFilterBar.tsx
import React, { useState, useMemo } from 'react';
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
  Chip,
} from 'react-native-paper';

import type { LibraryFilter, ReadableType } from '../types';
import {
  DEFAULT_LIBRARY_FILTER_STATE,
  type LibraryFilterState,
  type LibrarySortField,
} from '../types/libraryFilters';
import { useSearchVocabulary } from '../hooks/useSearchVocabulary';
import type { SearchToken } from '../services/searchVocabularyService';
import { normalizeForSearch } from '../services/libraryFilterService';

export interface LibraryFilterBarProps {
  filter: LibraryFilterState;
  onFilterChange: (next: LibraryFilterState) => void;
  /**
   * Optional label to show when we arrived here from a tag tap,
   * e.g. "Filtered by tag: Found Family"
   */
  activeTagLabel?: string | null;
}

const STATUS_FILTERS: LibraryFilter[] = ['all', 'to-read', 'reading', 'finished', 'DNF'];

const TYPE_FILTERS: { value: 'all' | ReadableType; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'book', label: 'Books' },
  { value: 'fanfic', label: 'Fanfic' },
];

const SORT_CONFIG: { value: LibrarySortField; label: string }[] = [
  { value: 'createdAt', label: 'Latest' },
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'priority', label: 'Priority' },
  { value: 'progressPercent', label: 'Progress' },
];

const MIN_SUGGESTION_CHARS = 2;
const MAX_SUGGESTIONS = 6;

const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({
  filter,
  onFilterChange,
  activeTagLabel,
}) => {
  const theme = useTheme();

  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [typeDialogVisible, setTypeDialogVisible] = useState(false);
  const [sortDialogVisible, setSortDialogVisible] = useState(false);

  // Local draft for the search input. Only becomes "real" when user commits it as a term.
  const [searchDraft, setSearchDraft] = useState<string>('');

  const { tokens: vocabulary } = useSearchVocabulary();

  const suggestions = useMemo(
    () => getSuggestions(vocabulary, searchDraft, filter.searchTerms),
    [vocabulary, searchDraft, filter.searchTerms],
  );

  const handleStatusChange = (status: LibraryFilter) => {
    onFilterChange({
      ...filter,
      status,
    });
    setStatusDialogVisible(false);
  };

  const handleTypeChange = (typeValue: string) => {
    const type = typeValue as 'all' | ReadableType;
    onFilterChange({
      ...filter,
      type,
    });
    setTypeDialogVisible(false);
  };

  const handleSortFieldChange = (field: LibrarySortField) => {
    let direction = filter.sortDirection;

    if (filter.sortField === field) {
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

    onFilterChange({
      ...filter,
      sortField: field,
      sortDirection: direction,
    });
    setSortDialogVisible(false);
  };

  const toggleSortDirection = () => {
    const nextDirection = filter.sortDirection === 'asc' ? 'desc' : 'asc';
    onFilterChange({
      ...filter,
      sortDirection: nextDirection,
    });
  };

  const handleClearAllFilters = () => {
    onFilterChange(DEFAULT_LIBRARY_FILTER_STATE);
    setSearchDraft('');
  };

  const statusLabel = labelForStatus(filter.status);
  const typeLabel = (() => {
    if (filter.type === 'all') return 'All types';
    return filter.type === 'book' ? 'Books' : 'Fanfic';
  })();
  const sortFieldLabel = SORT_CONFIG.find((s) => s.value === filter.sortField)?.label ?? 'Sort';
  const sortDirectionIcon = filter.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';

  const toggleFiltersCollapsed = () => {
    setFiltersCollapsed((prev) => !prev);
  };

  const commitSearchDraft = () => {
    const term = searchDraft.trim();
    if (!term) return;

    // Avoid duplicates (by raw label)
    if (filter.searchTerms.includes(term)) {
      setSearchDraft('');
      return;
    }

    onFilterChange({
      ...filter,
      searchTerms: [...filter.searchTerms, term],
      // legacy field left empty; canonical is searchTerms[]
      searchQuery: '',
    });
    setSearchDraft('');
  };

  const handleRemoveSearchTerm = (term: string) => {
    onFilterChange({
      ...filter,
      searchTerms: filter.searchTerms.filter((t) => t !== term),
    });
  };

  const handleSuggestionPress = (token: SearchToken) => {
    const label = token.label.trim();
    if (!label) return;

    // Avoid duplicates by label
    if (filter.searchTerms.includes(label)) {
      setSearchDraft('');
      return;
    }

    onFilterChange({
      ...filter,
      searchTerms: [...filter.searchTerms, label],
      searchQuery: '',
    });
    setSearchDraft('');
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
        placeholder={
          filter.searchTerms.length === 0 ? 'Search library…' : 'Add another search term…'
        }
        value={searchDraft}
        onChangeText={setSearchDraft}
        onIconPress={commitSearchDraft}
        onSubmitEditing={commitSearchDraft}
        style={styles.searchbar}
      />

      {suggestions.length > 0 && (
        <View style={styles.suggestionsRow}>
          {suggestions.map((token) => (
            <Chip
              key={token.id}
              style={styles.suggestionChip}
              icon="plus"
              onPress={() => handleSuggestionPress(token)}
            >
              {token.label}
            </Chip>
          ))}
        </View>
      )}

      {filter.searchTerms.length > 0 && (
        <View style={styles.searchTermsRow}>
          {filter.searchTerms.map((term) => (
            <Chip
              key={term}
              style={styles.searchTermChip}
              onClose={() => handleRemoveSearchTerm(term)}
            >
              {term}
            </Chip>
          ))}
        </View>
      )}

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
              value={filter.status}
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
            <RadioButton.Group onValueChange={handleTypeChange} value={filter.type}>
              {TYPE_FILTERS.map((t) => (
                <RadioButton.Item key={t.value} label={t.label} value={t.value} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTypeDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Sort dialog */}
        <Dialog visible={sortDialogVisible} onDismiss={() => setSortDialogVisible(false)}>
          <Dialog.Title>Sort by</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => handleSortFieldChange(value as LibrarySortField)}
              value={filter.sortField}
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
 * Shared outlined filter button so all filters (status/type/sort)
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

function getSuggestions(
  vocabulary: SearchToken[],
  draft: string,
  selectedTerms: string[],
): SearchToken[] {
  const draftNorm = normalizeForSearch(draft);
  if (!draftNorm || draftNorm.length < MIN_SUGGESTION_CHARS) {
    return [];
  }

  const selectedNorms = new Set(
    selectedTerms.map((t) => normalizeForSearch(t)).filter((n) => n.length > 0),
  );

  const scored: { token: SearchToken; score: number }[] = [];

  for (const token of vocabulary) {
    if (!token.normalized) continue;
    if (selectedNorms.has(token.normalized)) continue;

    const norm = token.normalized;

    let score = 0;

    // Exact normalized match
    if (norm === draftNorm) score += 1000;
    // Prefix match
    if (norm.startsWith(draftNorm)) score += 500;
    // Word-prefix match (e.g. "fast" in "very fast paced")
    if (norm.includes(` ${draftNorm}`)) score += 300;
    // Loose substring
    if (norm.includes(draftNorm)) score += 100;

    if (score === 0) continue;

    // Nudge by frequency but don't let it dominate
    score += Math.min(token.frequency, 50);

    scored.push({ token, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.token.label.localeCompare(b.token.label, undefined, { sensitivity: 'base' });
  });

  return scored.slice(0, MAX_SUGGESTIONS).map((s) => s.token);
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
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  suggestionChip: {
    marginRight: 6,
    marginBottom: 4,
  },
  searchTermsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  searchTermChip: {
    marginRight: 6,
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
