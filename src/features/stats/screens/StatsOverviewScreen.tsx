// src/features/stats/screens/StatsOverviewScreen.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import { Card, Text } from 'react-native-paper';
import { getStatsOverview } from '../services/statsService';
import ReadingByMoodChart from '../components/ReadingByMoodChart';
import ReadingByTypeChart from '../components/ReadingByTypeChart';

const StatsOverviewScreen: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: getStatsOverview,
  });

  if (isLoading && !data) {
    return (
      <Screen>
        <LoadingState message="Calculating stats…" />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <ErrorState message="Failed to load stats." onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Total in queue</Text>
          <Text variant="headlineMedium">{data.total}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">By mood</Text>
          <ReadingByMoodChart data={data.byMood} />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">By type</Text>
          <ReadingByTypeChart data={data.byType} />
        </Card.Content>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
});

export default StatsOverviewScreen;
