// src/features/readables/screens/ReadableListScreen.tsx
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { FAB, Chip } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import ReadableCard from '../components/ReadableCard';
import ReadableListEmptyState from '../components/ReadableListEmptyState';
import { useReadables } from '../hooks/useReadables';
import type { RootStackParamList } from '@src/navigation/types';
import type { ReadableStatus } from '../types';
import { READABLE_STATUS_LABELS } from '../types';

type RootNav = NavigationProp<RootStackParamList>;
type LibraryFilter = 'all' | ReadableStatus;

const ReadableListScreen: React.FC = () => {
  const navigation = useNavigation<RootNav>();
  const { data, isLoading, isError, refetch, isRefetching } = useReadables();

  const items = data ?? [];

  const [filter, setFilter] = useState<LibraryFilter>('all');

  const filteredItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );

  const filters: { key: LibraryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'to-read', label: READABLE_STATUS_LABELS['to-read'] },
    { key: 'reading', label: READABLE_STATUS_LABELS.reading },
    { key: 'finished', label: READABLE_STATUS_LABELS.finished },
    { key: 'DNF', label: READABLE_STATUS_LABELS.DNF },
  ];

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
    navigation.navigate('QuickAddReadable');
  };

  return (
    <Screen>
      {items.length === 0 ? (
        <ReadableListEmptyState onAdd={handleAdd} />
      ) : (
        <>
          <View style={styles.filtersContainer}>
            {filters.map((f) => (
              <Chip
                key={f.key}
                style={styles.filterChip}
                selected={filter === f.key}
                onPress={() => setFilter(f.key)}
              >
                {f.label}
              </Chip>
            ))}
          </View>

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
              <Text style={styles.emptyFilteredText}>No readables match this filter yet.</Text>
            }
          />
          <FAB icon="plus" style={styles.fab} onPress={handleAdd} />
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterChip: {
    marginRight: 6,
    marginBottom: 6,
  },
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
