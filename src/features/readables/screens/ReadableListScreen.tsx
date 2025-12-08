// src/features/readables/screens/ReadableListScreen.tsx
import React, { useEffect, useState } from 'react';
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
import SmartShelvesBar from '../components/SmartShelvesBar';

import type { MainTabsParamList, RootStackParamList } from '@src/navigation/types';
import {
  DEFAULT_LIBRARY_FILTER_STATE,
  isDefaultLibraryFilterState,
  type LibraryFilterState,
} from '../types/libraryFilters';
import { useLibraryReadables } from '../hooks/useLibraryReadables';
import { useSmartShelves } from '../hooks/useSmartShelves';
import type { SmartShelf, SmartShelfId } from '../types/smartShelves';

type RootNav = NavigationProp<RootStackParamList>;
type LibraryRoute = RouteProp<MainTabsParamList, 'Library'>;

const ReadableListScreen: React.FC = () => {
  const navigation = useNavigation<RootNav>();
  const route = useRoute<LibraryRoute>();

  const initialQuery = route.params?.initialQuery;

  const [filterState, setFilterState] = useState<LibraryFilterState>(DEFAULT_LIBRARY_FILTER_STATE);
  const [activeTagLabel, setActiveTagLabel] = useState<string | null>(null);

  // 'all' represents the implicit default shelf.
  const [selectedShelfId, setSelectedShelfId] = useState<'all' | SmartShelfId>('all');

  const { data: shelves = [] } = useSmartShelves();

  // Seed filter when arriving via a tag tap (or when params change)
  useEffect(() => {
    if (initialQuery?.searchQuery != null || initialQuery?.tagLabel != null) {
      const tagOrQuery = initialQuery.tagLabel ?? initialQuery.searchQuery ?? '';
      const term = tagOrQuery.trim();

      if (!term) {
        return;
      }

      setFilterState((prev) => {
        if (prev.searchTerms.includes(term)) {
          return {
            ...prev,
            searchQuery: '',
          };
        }

        return {
          ...prev,
          searchTerms: [term],
          searchQuery: '',
        };
      });
      setActiveTagLabel(term);
      setSelectedShelfId('all');
    }
  }, [initialQuery?.searchQuery, initialQuery?.tagLabel]);

  const { items, isLoading, isError, refetch, isRefetching } = useLibraryReadables(filterState);

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

  const handleFilterChange = (next: LibraryFilterState) => {
    setFilterState(next);
    // Any manual filter changes means we're no longer strictly "on" a saved shelf.
    setSelectedShelfId('all');

    const hasSearch =
      next.searchQuery.trim().length > 0 || next.searchTerms.some((t) => t.trim().length > 0);

    if (!hasSearch) {
      setActiveTagLabel(null);
    }
  };

  const handleSelectAllShelf = () => {
    setSelectedShelfId('all');
    setActiveTagLabel(null);
    setFilterState(DEFAULT_LIBRARY_FILTER_STATE);
  };

  const handleSelectShelf = (shelf: SmartShelf) => {
    setSelectedShelfId(shelf.id);
    setActiveTagLabel(null);
    setFilterState(shelf.filter);
  };

  const isUsingDefaultFilters = isDefaultLibraryFilterState(filterState);

  return (
    <Screen>
      <SmartShelvesBar
        shelves={shelves}
        selectedShelfId={selectedShelfId}
        onSelectAll={handleSelectAllShelf}
        onSelectShelf={handleSelectShelf}
        currentFilter={filterState}
      />

      <LibraryFilterBar
        filter={filterState}
        onFilterChange={handleFilterChange}
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
          isUsingDefaultFilters ? (
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
