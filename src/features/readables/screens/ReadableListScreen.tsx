// src/features/readables/screens/ReadableListScreen.tsx
import React from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import ReadableCard from '../components/ReadableCard';
import ReadableListEmptyState from '../components/ReadableListEmptyState';
import { useReadables } from '../hooks/useReadables';
import type { RootStackParamList } from '@src/navigation/types';
import { FAB } from 'react-native-paper';

type RootNav = NavigationProp<RootStackParamList>;

const ReadableListScreen: React.FC = () => {
  const navigation = useNavigation<RootNav>();
  const { data, isLoading, isError, refetch, isRefetching } = useReadables();

  if (isLoading && !data) {
    return (
      <Screen>
        <LoadingState message="Loading queue…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message="Failed to load your queue." onRetry={refetch} />
      </Screen>
    );
  }

  const items = data ?? [];

  const handleAdd = () => {
    navigation.navigate('EditReadable', {});
  };

  return (
    <Screen>
      {items.length === 0 ? (
        <ReadableListEmptyState onAdd={handleAdd} />
      ) : (
        <>
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
          />
          <FAB icon="plus" style={styles.fab} onPress={handleAdd} />
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

export default ReadableListScreen;
