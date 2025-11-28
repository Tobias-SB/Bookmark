// src/features/readables/screens/ReadableListScreen.tsx
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { FAB } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import ReadableCard from '../components/ReadableCard';
import ReadableListEmptyState from '../components/ReadableListEmptyState';
import LibraryFilterBar from '../components/LibraryFilterBar';
import { useReadables } from '../hooks/useReadables';
import type { RootStackParamList } from '@src/navigation/types';
import type { LibraryFilter } from '../types';

type RootNav = NavigationProp<RootStackParamList>;

const ReadableListScreen: React.FC = () => {
  const navigation = useNavigation<RootNav>();
  const { data, isLoading, isError, refetch, isRefetching } = useReadables();

  const items = data ?? [];

  const [filter, setFilter] = useState<LibraryFilter>('all');

  const filteredItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );

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

  return (
    <Screen>
      {items.length === 0 ? (
        <ReadableListEmptyState onAdd={handleAdd} />
      ) : (
        <>
          <LibraryFilterBar value={filter} onChange={setFilter} />

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
