// src/features/readables/screens/ReadableListScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { FAB } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import ReadableCard from '../components/ReadableCard';
import ReadableListEmptyState from '../components/ReadableListEmptyState';
import LibraryFilterBar from '../components/LibraryFilterBar';
import type { MainTabsParamList, RootStackParamList } from '@src/navigation/types';
import type { LibraryQueryParams } from '../types/libraryQuery';
import type { LibraryFilterState, LibrarySortField } from '../types/libraryFilters';
import { DEFAULT_LIBRARY_FILTER_STATE } from '../types/libraryFilters';
import { useLibraryReadables } from '../hooks/useLibraryReadables';

type RootNav = NavigationProp<RootStackParamList>;
type LibraryRoute = RouteProp<MainTabsParamList, 'Library'>;

const DEFAULT_QUERY: LibraryQueryParams = {
  status: 'all',
  type: undefined,
  minPriority: undefined,
  maxPriority: undefined,
  searchQuery: null,
  sort: {
    field: 'createdAt',
    direction: 'desc',
  },
};

const ReadableListScreen: React.FC = () => {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<LibraryRoute>();

  const initialQuery = route.params?.initialQuery;

  const [query, setQuery] = useState<LibraryQueryParams>(DEFAULT_QUERY);
  const [activeTagLabel, setActiveTagLabel] = useState<string | null>(null);

  // Seed query when arriving via a tag tap (or when params change)
  useEffect(() => {
    if (initialQuery?.searchQuery != null || initialQuery?.tagLabel != null) {
      setQuery((prev) => ({
        ...prev,
        searchQuery: initialQuery.searchQuery ?? null,
      }));
      setActiveTagLabel(initialQuery.tagLabel ?? initialQuery.searchQuery ?? null);
    }
  }, [initialQuery?.searchQuery, initialQuery?.tagLabel]);

  // Bridge from legacy LibraryQueryParams → new LibraryFilterState
  const filterState: LibraryFilterState = useMemo(() => mapQueryToFilterState(query), [query]);

  const { items, isLoading, isError, error, refetch, isRefetching } =
    useLibraryReadables(filterState);

  if (isLoading && items.length === 0) {
    return (
      <Screen>
        <LoadingState message="Loading library…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message="Failed to load your library." onRetry={refetch} />
      </Screen>
    );
  }

  const handleAdd = () => {
    Alert.alert('Add to library', 'How would you like to add a readable?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Quick add',
        onPress: () => navigation.navigate('QuickAddReadable'),
      },
      {
        text: 'Manual',
        onPress: () => {
          // Manual add: go straight to full edit in "create" mode
          navigation.navigate('EditReadable', {} as RootStackParamList['EditReadable']);
        },
      },
    ]);
  };

  const handleQueryChange = (next: LibraryQueryParams) => {
    setQuery(next);

    // If user clears search, drop any active tag label
    if (!next.searchQuery) {
      setActiveTagLabel(null);
    }
  };

  const isUsingDefaultQuery = isDefaultQuery(query);

  return (
    <Screen>
      <LibraryFilterBar
        query={query}
        onQueryChange={handleQueryChange}
        activeTagLabel={activeTagLabel}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <ReadableCard
            item={item}
            onPress={() => navigation.navigate('ReadableDetail', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          isUsingDefaultQuery ? (
            // True "empty library" state
            <ReadableListEmptyState onAdd={handleAdd} />
          ) : (
            // Filters/search applied but no matches
            <Text style={styles.emptyFilteredText}>No readables match these filters yet.</Text>
          )
        }
      />

      <FAB icon="plus" style={styles.fab} onPress={handleAdd} />
    </Screen>
  );
};

/**
 * Temporary bridge layer from the legacy LibraryQueryParams
 * to the new canonical LibraryFilterState.
 *
 * This lets us:
 * - Keep LibraryFilterBar + route params working as-is.
 * - Use the new normalized filter/sort "brain" underneath.
 *
 * Later, we can update LibraryFilterBar to work directly with
 * LibraryFilterState and delete this mapper.
 */
function mapQueryToFilterState(query: LibraryQueryParams): LibraryFilterState {
  const sortField = query.sort.field as LibrarySortField;

  return {
    ...DEFAULT_LIBRARY_FILTER_STATE,
    searchQuery: query.searchQuery ?? '',
    status: query.status,
    type: query.type ?? 'all',
    // rating & workState defaults are already in DEFAULT_LIBRARY_FILTER_STATE
    sortField,
    sortDirection: query.sort.direction,
    // moodTags remains [] for now – we’ll wire mood filtering via UI later.
  };
}

/**
 * Checks if the current UI-facing query matches the default query.
 * Used to distinguish "truly empty library" from
 * "no results because of filters/search".
 */
function isDefaultQuery(query: LibraryQueryParams): boolean {
  if (query.status !== DEFAULT_QUERY.status) return false;
  if (query.type !== DEFAULT_QUERY.type) return false;
  if (query.minPriority !== DEFAULT_QUERY.minPriority) return false;
  if (query.maxPriority !== DEFAULT_QUERY.maxPriority) return false;
  if (query.searchQuery !== DEFAULT_QUERY.searchQuery) return false;
  if (query.sort.field !== DEFAULT_QUERY.sort.field) return false;
  if (query.sort.direction !== DEFAULT_QUERY.sort.direction) return false;
  return true;
}

const styles = StyleSheet.create({
  emptyFilteredText: {
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

export default ReadableListScreen;
