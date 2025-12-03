// src/features/readables/screens/ReadableListScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { FAB } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import ReadableCard from '../components/ReadableCard';
import ReadableListEmptyState from '../components/ReadableListEmptyState';
import LibraryFilterBar from '../components/LibraryFilterBar';
import { useReadables } from '../hooks/useReadables';
import type { MainTabsParamList, RootStackParamList } from '@src/navigation/types';
import type { ReadableItem, ReadableType } from '../types';
import type { LibraryQueryParams } from '../types/libraryQuery';

type RootNav = NavigationProp<RootStackParamList>;
type LibraryRoute = RouteProp<MainTabsParamList, 'Library'>;

const DEFAULT_QUERY: LibraryQueryParams = {
  status: 'all',
  types: undefined,
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

  const { data, isLoading, isError, refetch, isRefetching } = useReadables();
  const items = data ?? [];

  const initialQuery = route.params?.initialQuery;

  const [query, setQuery] = useState<LibraryQueryParams>(DEFAULT_QUERY);
  const [activeTagLabel, setActiveTagLabel] = useState<string | null>(null);

  // Seed query when arriving via a tag tap (or when params change)
  useEffect(() => {
    if (initialQuery?.searchQuery != null) {
      setQuery((prev) => ({
        ...prev,
        searchQuery: initialQuery.searchQuery,
      }));
      setActiveTagLabel(initialQuery.tagLabel ?? initialQuery.searchQuery ?? null);
    }
  }, [initialQuery?.searchQuery, initialQuery?.tagLabel]);

  const filteredItems = useMemo(() => applyLibraryQuery(items, query), [items, query]);

  if (isLoading && !data) {
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

  return (
    <Screen>
      {items.length === 0 ? (
        <ReadableListEmptyState onAdd={handleAdd} />
      ) : (
        <>
          <LibraryFilterBar
            query={query}
            onQueryChange={handleQueryChange}
            activeTagLabel={activeTagLabel}
          />

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            renderItem={({ item }) => (
              <ReadableCard
                item={item}
                onPress={() => navigation.navigate('ReadableDetail', { id: item.id })}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyFilteredText}>No readables match these filters yet.</Text>
            }
          />
          <FAB icon="plus" style={styles.fab} onPress={handleAdd} />
        </>
      )}
    </Screen>
  );
};

function applyLibraryQuery(items: ReadableItem[], query: LibraryQueryParams): ReadableItem[] {
  let result = items.slice();

  // Status
  if (query.status && query.status !== 'all') {
    result = result.filter((item) => item.status === query.status);
  }

  // Types
  if (query.types && query.types.length > 0) {
    const typeSet = new Set<ReadableType>(query.types);
    result = result.filter((item) => typeSet.has(item.type));
  }

  // Priority
  if (query.minPriority != null || query.maxPriority != null) {
    const min = query.minPriority ?? 1;
    const max = query.maxPriority ?? 5;
    result = result.filter((item) => item.priority >= min && item.priority <= max);
  }

  // Full-text-ish search
  if (query.searchQuery && query.searchQuery.trim().length > 0) {
    const q = query.searchQuery.trim().toLowerCase();

    result = result.filter((item) => {
      const haystackParts: string[] = [];

      if (item.title) haystackParts.push(item.title);
      if (item.author) haystackParts.push(item.author);
      if (item.description) haystackParts.push(item.description);

      // Mood tags (string labels or MoodTag objects)
      if (Array.isArray(item.moodTags)) {
        for (const mood of item.moodTags as any[]) {
          if (typeof mood === 'string') {
            haystackParts.push(mood);
          } else if (mood && typeof mood.label === 'string') {
            haystackParts.push(mood.label);
          }
        }
      }

      // Fanfic-specific fields
      if (item.type === 'fanfic') {
        haystackParts.push(...item.fandoms);
        haystackParts.push(...item.relationships);
        haystackParts.push(...item.characters);
        haystackParts.push(...item.ao3Tags);
        haystackParts.push(...item.warnings);
      }

      // Book-specific fields
      if (item.type === 'book') {
        haystackParts.push(...item.genres);
      }

      const haystack = haystackParts.join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // Sorting
  result.sort((a, b) => compareReadables(a, b, query.sort));

  return result;
}

function compareReadables(
  a: ReadableItem,
  b: ReadableItem,
  sort: LibraryQueryParams['sort'],
): number {
  const { field, direction } = sort;
  const dir = direction === 'asc' ? 1 : -1;

  switch (field) {
    case 'createdAt': {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      if (aDate === bDate) return 0;
      return aDate > bDate ? dir : -dir;
    }
    case 'updatedAt': {
      const aDate = new Date(a.updatedAt).getTime();
      const bDate = new Date(b.updatedAt).getTime();
      if (aDate === bDate) return 0;
      return aDate > bDate ? dir : -dir;
    }
    case 'title':
      return compareStrings(a.title, b.title, dir);
    case 'author':
      return compareStrings(a.author, b.author, dir);
    case 'priority':
      if (a.priority === b.priority) return 0;
      return a.priority > b.priority ? dir : -dir;
    default:
      return 0;
  }
}

function compareStrings(a: string | null, b: string | null, dir: 1 | -1): number {
  const aVal = (a ?? '').toLowerCase();
  const bVal = (b ?? '').toLowerCase();
  if (aVal === bVal) return 0;
  return aVal > bVal ? dir : -dir;
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
