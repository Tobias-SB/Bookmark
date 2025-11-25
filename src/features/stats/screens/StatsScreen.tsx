// src/features/stats/screens/StatsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme, IconButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import { ReadableItem, ReadableStatus, ReadableType } from '@src/features/readables/types';

// Stats overview service + charts
import { getStatsOverview } from '../services/statsService';
import ReadingByMoodChart from '../components/ReadingByMoodChart';
import ReadingByTypeChart from '../components/ReadingByTypeChart';

// ---------- Collapsible Card component ----------

type CollapsibleCardProps = {
  title: string;
  children: React.ReactNode;
  initiallyCollapsed?: boolean;
};

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  initiallyCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <Card style={styles.card}>
      <Pressable onPress={toggle}>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium">{title}</Text>
          <IconButton icon={collapsed ? 'chevron-down' : 'chevron-up'} onPress={toggle} />
        </View>
      </Pressable>
      {!collapsed && <Card.Content>{children}</Card.Content>}
    </Card>
  );
};

// ---------- Data hooks ----------

function useAllReadables() {
  return useQuery({
    queryKey: ['readables', 'all'],
    queryFn: () => readableRepository.getAll(), // all items, any status
  });
}

// We don't need strict typing for the overview shape here
type StatsOverviewData = any;

function useStatsOverview() {
  return useQuery<StatsOverviewData>({
    queryKey: ['stats', 'overview'],
    queryFn: getStatsOverview,
  });
}

// ---------- Stats helpers ----------

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

interface MonthlyCompletionGroup {
  monthKey: string;
  label: string;
  items: ReadableItem[];
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
 * Completed counts per month (for the "Completed per month" list).
 * Uses updatedAt as "finished at", since that changes when status goes to 'finished'.
 */
function computeMonthlyCompletions(readables: ReadableItem[]): MonthlyCompletionStat[] {
  const map = new Map<string, { count: number; sampleDate: Date }>();

  for (const r of readables) {
    if (r.status !== 'finished') continue;

    const dateString = r.updatedAt ?? r.createdAt;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const existing = map.get(monthKey);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(monthKey, { count: 1, sampleDate: d });
    }
  }

  const stats: MonthlyCompletionStat[] = Array.from(map.entries())
    .map(([monthKey, { count, sampleDate }]) => ({
      monthKey,
      count,
      label: sampleDate.toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      }),
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)); // newest first

  return stats;
}

/**
 * Group actual finished items by month so you can see
 * "which titles did I finish in March 2025?".
 */
function computeMonthlyCompletionGroups(readables: ReadableItem[]): MonthlyCompletionGroup[] {
  const map = new Map<string, { items: ReadableItem[]; sampleDate: Date }>();

  for (const r of readables) {
    if (r.status !== 'finished') continue;

    const dateString = r.updatedAt ?? r.createdAt;
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const existing = map.get(monthKey);
    if (existing) {
      existing.items.push(r);
      if (d > existing.sampleDate) {
        existing.sampleDate = d;
      }
    } else {
      map.set(monthKey, { items: [r], sampleDate: d });
    }
  }

  const groups: MonthlyCompletionGroup[] = Array.from(map.entries())
    .map(([monthKey, { items, sampleDate }]) => ({
      monthKey,
      label: sampleDate.toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      }),
      items: items.slice().sort((a, b) => {
        const da = new Date(a.updatedAt ?? a.createdAt).getTime();
        const db = new Date(b.updatedAt ?? b.createdAt).getTime();
        return db - da; // newest finished first within the month
      }),
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)); // newest month first

  return groups;
}

// ---------- Screen component ----------

export function StatsScreen() {
  const theme = useTheme();

  const { data: readables, isLoading: readablesLoading, error: readablesError } = useAllReadables();

  const {
    data: overviewData,
    isLoading: overviewLoading,
    isError: overviewError,
  } = useStatsOverview();

  const stats = useMemo(() => computeStats(readables ?? []), [readables]);
  const monthlyCompletions = useMemo(() => computeMonthlyCompletions(readables ?? []), [readables]);
  const monthlyCompletionGroups = useMemo(
    () => computeMonthlyCompletionGroups(readables ?? []),
    [readables],
  );

  if (readablesLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Loading your stats…</Text>
        </View>
      </Screen>
    );
  }

  if (readablesError) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            Failed to load stats: {(readablesError as Error).message}
          </Text>
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
        {/* ---------- QUEUE OVERVIEW + CHARTS ---------- */}
        {overviewData && !overviewError && (
          <>
            <CollapsibleCard title="Queue overview">
              <Text>Total in queue: {overviewData.totalInQueue}</Text>
            </CollapsibleCard>

            <CollapsibleCard title="Reading by mood">
              <ReadingByMoodChart data={overviewData.byMood} />
            </CollapsibleCard>

            <CollapsibleCard title="Reading by type">
              <ReadingByTypeChart data={overviewData.byType} />
            </CollapsibleCard>
          </>
        )}

        {overviewLoading && !overviewData && (
          <CollapsibleCard title="Queue overview">
            <ActivityIndicator />
            <Text style={styles.centerText}>Loading charts…</Text>
          </CollapsibleCard>
        )}

        {overviewError && (
          <CollapsibleCard title="Queue overview">
            <Text style={styles.errorText}>
              Failed to load overview charts. Other stats are still available.
            </Text>
          </CollapsibleCard>
        )}

        {/* ---------- OVERVIEW COUNTS FROM ALL READABLES ---------- */}
        <CollapsibleCard title="Overview">
          <Text>Total items: {stats.total}</Text>
          <Text>In queue: {stats.inQueueCount}</Text>
          <Text>Currently reading: {stats.readingCount}</Text>
          <Text>Completed: {stats.completedCount}</Text>
          <Text>Abandoned: {stats.abandonedCount}</Text>
        </CollapsibleCard>

        <CollapsibleCard title="By type">
          <Text>Books: {stats.byType.book}</Text>
          <Text>Fanfic: {stats.byType.fanfic}</Text>
        </CollapsibleCard>

        <CollapsibleCard title="By status">
          <Text>Queued: {stats.byStatus['to-read']}</Text>
          <Text>Reading: {stats.byStatus.reading}</Text>
          <Text>Completed: {stats.byStatus.finished}</Text>
          <Text>Abandoned: {stats.byStatus.abandoned}</Text>
        </CollapsibleCard>

        {/* ---------- COMPLETIONS OVER TIME ---------- */}
        {monthlyCompletions.length > 0 && (
          <CollapsibleCard title="Completed per month">
            {monthlyCompletions.map((m) => (
              <View key={m.monthKey} style={styles.rowBetween}>
                <Text>{m.label}</Text>
                <Text>{m.count}</Text>
              </View>
            ))}
          </CollapsibleCard>
        )}

        {monthlyCompletionGroups.length > 0 && (
          <CollapsibleCard title="What you finished by month">
            {monthlyCompletionGroups.map((group) => (
              <View key={group.monthKey} style={styles.monthGroup}>
                <Text style={styles.monthTitle}>
                  {group.label} ({group.items.length})
                </Text>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.finishedItemRow}>
                    <Text style={styles.finishedItemTitle}>{item.title}</Text>
                    <Text style={styles.finishedItemMeta}>
                      {item.type === 'book' ? 'Book' : 'Fanfic'}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </CollapsibleCard>
        )}
      </ScrollView>
    </Screen>
  );
}

// ---------- Styles ----------

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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthGroup: {
    marginTop: 12,
  },
  monthTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  finishedItemRow: {
    marginLeft: 8,
    marginBottom: 2,
  },
  finishedItemTitle: {
    fontSize: 14,
  },
  finishedItemMeta: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default StatsScreen;
