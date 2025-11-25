// src/features/stats/screens/StatsScreen.tsx
import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import { ReadableItem, ReadableStatus, ReadableType } from '@src/features/readables/types';

function useAllReadables() {
  return useQuery({
    queryKey: ['readables', 'all'],
    queryFn: () => readableRepository.getAllToRead(),
  });
}

type StatusCounts = Record<ReadableStatus, number>;
type TypeCounts = Record<ReadableType, number>;

interface StatsSummary {
  total: number;
  byStatus: StatusCounts;
  byType: TypeCounts;
  completedCount: number;
  inQueueCount: number;
  readingCount: number;
  abandonedCount: number;
}

interface MonthlyCompletionStat {
  monthKey: string; // e.g. '2025-03'
  label: string; // e.g. 'Mar 2025'
  count: number;
}

function computeStats(readables: ReadableItem[]): StatsSummary {
  const byStatus: StatusCounts = {
    'to-read': 0,
    reading: 0,
    finished: 0,
    abandoned: 0,
  };

  const byType: TypeCounts = {
    book: 0,
    fanfic: 0,
  };

  for (const r of readables) {
    byStatus[r.status] += 1;
    byType[r.type] += 1;
  }

  return {
    total: readables.length,
    byStatus,
    byType,
    completedCount: byStatus.finished,
    inQueueCount: byStatus['to-read'],
    readingCount: byStatus.reading,
    abandonedCount: byStatus.abandoned,
  };
}

/**
 * Group completed items by month, using `updatedAt` as the "finished at" date.
 */
function computeMonthlyCompletions(readables: ReadableItem[]): MonthlyCompletionStat[] {
  const map = new Map<string, { count: number; sampleDate: Date }>();

  for (const r of readables) {
    if (r.status !== 'finished') continue;

    const dateString = r.updatedAt ?? r.createdAt;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 0-based
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const existing = map.get(monthKey);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(monthKey, { count: 1, sampleDate: d });
    }
  }

  // Sort newest first
  const stats: MonthlyCompletionStat[] = Array.from(map.entries())
    .map(([monthKey, { count, sampleDate }]) => ({
      monthKey,
      count,
      label: sampleDate.toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      }),
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));

  return stats;
}

export function StatsScreen() {
  const theme = useTheme();
  const { data: readables, isLoading, error } = useAllReadables();

  const stats = useMemo(() => computeStats(readables ?? []), [readables]);
  const monthlyCompletions = useMemo(() => computeMonthlyCompletions(readables ?? []), [readables]);

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Loading your stats…</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load stats: {(error as Error).message}</Text>
        </View>
      </Screen>
    );
  }

  if (!readables || readables.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.centerText}>
            No items in your queue yet. Add a book or fic to see stats here.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}
      >
        <Card style={styles.card}>
          <Card.Title title="Overview" />
          <Card.Content>
            <Text>Total items: {stats.total}</Text>
            <Text>In queue: {stats.inQueueCount}</Text>
            <Text>Currently reading: {stats.readingCount}</Text>
            <Text>Completed: {stats.completedCount}</Text>
            <Text>Abandoned: {stats.abandonedCount}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="By Type" />
          <Card.Content>
            <Text>Books: {stats.byType.book}</Text>
            <Text>Fanfic: {stats.byType.fanfic}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="By Status" />
          <Card.Content>
            <Text>Queued: {stats.byStatus['to-read']}</Text>
            <Text>Reading: {stats.byStatus.reading}</Text>
            <Text>Completed: {stats.byStatus.finished}</Text>
            <Text>Abandoned: {stats.byStatus.abandoned}</Text>
          </Card.Content>
        </Card>

        {monthlyCompletions.length > 0 && (
          <Card style={styles.card}>
            <Card.Title title="Completed per month" />
            <Card.Content>
              {monthlyCompletions.map((m) => (
                <View key={m.monthKey} style={styles.rowBetween}>
                  <Text>{m.label}</Text>
                  <Text>{m.count}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  centerText: {
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});

export default StatsScreen;
