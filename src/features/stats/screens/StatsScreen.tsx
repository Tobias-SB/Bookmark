// src/features/stats/screens/StatsScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import {
  ActivityIndicator,
  Card,
  Text,
  useTheme,
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';

import Screen from '@src/components/common/Screen';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import { ReadableItem, ReadableStatus, ReadableType } from '@src/features/readables/types';
import type { MoodStats, TypeStats } from '../services/statsService';
import StatsPieChart, { PieDatum } from '../components/StatsPieChart';

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

// ---------- Types & helpers ----------

type StatsView = 'activity' | 'mood' | 'type';

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

interface MonthlyActivityBucket {
  monthKey: string; // '2025-03'
  label: string; // 'Mar 2025'
  added: ReadableItem[];
  started: ReadableItem[];
  finished: ReadableItem[];
  dnf: ReadableItem[];
}

interface ActivityCounts {
  added: number;
  started: number;
  finished: number;
  dnf: number;
  totalEvents: number;
}

function computeStats(readables: ReadableItem[]): StatsSummary {
  const byStatus: StatusCounts = {
    'to-read': 0,
    reading: 0,
    finished: 0,
    DNF: 0,
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
    abandonedCount: byStatus.DNF,
  };
}

function toMonthKeyAndLabel(dateString: string): { key: string; label: string } | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const label = d.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });

  return { key, label };
}

/**
 * Build per-month activity buckets based on:
 * - createdAt  → added
 * - startedAt  → started
 * - finishedAt → finished
 * - dnfAt      → dnf
 */
function buildMonthlyActivityBuckets(readables: ReadableItem[]): MonthlyActivityBucket[] {
  const map = new Map<string, MonthlyActivityBucket>();

  const ensureBucket = (key: string, label: string): MonthlyActivityBucket => {
    const existing = map.get(key);
    if (existing) return existing;
    const bucket: MonthlyActivityBucket = {
      monthKey: key,
      label,
      added: [],
      started: [],
      finished: [],
      dnf: [],
    };
    map.set(key, bucket);
    return bucket;
  };

  for (const item of readables) {
    // Added (always present)
    const addedInfo = toMonthKeyAndLabel(item.createdAt);
    if (addedInfo) {
      ensureBucket(addedInfo.key, addedInfo.label).added.push(item);
    }

    // Started
    if (item.startedAt) {
      const startedInfo = toMonthKeyAndLabel(item.startedAt);
      if (startedInfo) {
        ensureBucket(startedInfo.key, startedInfo.label).started.push(item);
      }
    }

    // Finished
    if (item.finishedAt) {
      const finishedInfo = toMonthKeyAndLabel(item.finishedAt);
      if (finishedInfo) {
        ensureBucket(finishedInfo.key, finishedInfo.label).finished.push(item);
      }
    }

    // DNF
    if (item.dnfAt) {
      const dnfInfo = toMonthKeyAndLabel(item.dnfAt);
      if (dnfInfo) {
        ensureBucket(dnfInfo.key, dnfInfo.label).dnf.push(item);
      }
    }
  }

  const buckets = Array.from(map.values()).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)); // newest first
  return buckets;
}

function computeActivityCountsForAll(buckets: MonthlyActivityBucket[]): ActivityCounts {
  let added = 0;
  let started = 0;
  let finished = 0;
  let dnf = 0;

  for (const b of buckets) {
    added += b.added.length;
    started += b.started.length;
    finished += b.finished.length;
    dnf += b.dnf.length;
  }

  const totalEvents = added + started + finished + dnf;
  return { added, started, finished, dnf, totalEvents };
}

function computeActivityCountsForBucket(bucket: MonthlyActivityBucket): ActivityCounts {
  const added = bucket.added.length;
  const started = bucket.started.length;
  const finished = bucket.finished.length;
  const dnf = bucket.dnf.length;
  const totalEvents = added + started + finished + dnf;
  return { added, started, finished, dnf, totalEvents };
}

function computeMoodStats(items: ReadableItem[]): MoodStats[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.moodTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([moodTag, count]) => ({ moodTag, count }))
    .sort((a, b) => b.count - a.count);
}

function computeTypeStats(items: ReadableItem[]): TypeStats[] {
  let books = 0;
  let fanfic = 0;

  for (const item of items) {
    if (item.type === 'book') books += 1;
    else fanfic += 1;
  }

  return [
    { type: 'book', count: books },
    { type: 'fanfic', count: fanfic },
  ];
}

function buildActivityPieData(counts: ActivityCounts): PieDatum[] {
  const { added, started, finished, dnf } = counts;
  const data: PieDatum[] = [];

  if (added > 0) data.push({ key: 'added', label: 'Added', value: added });
  if (started > 0) data.push({ key: 'started', label: 'Started', value: started });
  if (finished > 0) data.push({ key: 'finished', label: 'Finished', value: finished });
  if (dnf > 0) data.push({ key: 'dnf', label: 'DNF', value: dnf });

  return data;
}

function buildMoodPieData(moodStats: MoodStats[]): PieDatum[] {
  return moodStats.map((m) => ({
    key: m.moodTag,
    label: m.moodTag.replace('-', ' '),
    value: m.count,
  }));
}

function buildTypePieData(typeStats: TypeStats[]): PieDatum[] {
  return typeStats
    .filter((t) => t.count > 0)
    .map((t) => ({
      key: t.type,
      label: t.type === 'book' ? 'Books' : 'Fanfics',
      value: t.count,
    }));
}

/**
 * Unique set of items touched in this bucket (added/started/finished/dnf).
 */
function getUniqueItemsForBucket(bucket: MonthlyActivityBucket): ReadableItem[] {
  const byId = new Map<string, ReadableItem>();
  for (const list of [bucket.added, bucket.started, bucket.finished, bucket.dnf]) {
    for (const item of list) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values());
}

// ---------- Screen component ----------

export function StatsScreen() {
  const theme = useTheme();

  const {
    data: readables,
    isLoading: readablesLoading,
    error: readablesError,
    refetch: refetchReadables,
  } = useAllReadables();

  // 🔁 Refetch whenever the Stats tab gains focus
  useFocusEffect(
    useCallback(() => {
      refetchReadables();
    }, [refetchReadables]),
  );

  const safeReadables = readables ?? [];

  const stats = useMemo(() => computeStats(safeReadables), [safeReadables]);
  const monthlyBuckets = useMemo(() => buildMonthlyActivityBuckets(safeReadables), [safeReadables]);

  // All-time overview state (text only)
  const [overviewView, setOverviewView] = useState<StatsView>('activity');

  const allActivityCounts = useMemo(
    () => computeActivityCountsForAll(monthlyBuckets),
    [monthlyBuckets],
  );

  const allMoodStats = useMemo(() => computeMoodStats(safeReadables), [safeReadables]);
  const allTypeStats = useMemo(() => computeTypeStats(safeReadables), [safeReadables]);

  // Per-month view selection: monthKey -> 'activity' | 'mood' | 'type'
  const [monthViews, setMonthViews] = useState<Record<string, StatsView>>({});

  // ---------- Conditional UI (no conditional hooks) ----------

  let content: React.ReactNode;

  if (readablesLoading) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>Loading your stats…</Text>
      </View>
    );
  } else if (readablesError) {
    content = (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Failed to load stats: {(readablesError as Error).message}
        </Text>
      </View>
    );
  } else if (!safeReadables.length) {
    content = (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          No items in your library yet. Add a book or fic to see stats here.
        </Text>
      </View>
    );
  } else {
    content = (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}
      >
        {/* ---------- LIBRARY SNAPSHOT ---------- */}
        <CollapsibleCard title="Library snapshot">
          <Text>Total items: {stats.total}</Text>
          <Text>In queue: {stats.inQueueCount}</Text>
          <Text>Currently reading: {stats.readingCount}</Text>
          <Text>Completed: {stats.completedCount}</Text>
          <Text>Abandoned (DNF): {stats.abandonedCount}</Text>

          <View style={styles.rowBetweenTop}>
            <View style={styles.snapshotColumn}>
              <Text style={styles.snapshotHeading}>By type</Text>
              <Text>Books: {stats.byType.book}</Text>
              <Text>Fanfics: {stats.byType.fanfic}</Text>
            </View>
          </View>
        </CollapsibleCard>

        {/* ---------- OVERVIEW (ALL-TIME, TEXT ONLY) ---------- */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionHeader}>
              Overview – all time
            </Text>

            <Text style={styles.subLabel}>View</Text>
            <SegmentedButtons
              value={overviewView}
              onValueChange={(v) => setOverviewView(v as StatsView)}
              buttons={[
                { value: 'activity', label: 'Activity' },
                { value: 'mood', label: 'Mood' },
                { value: 'type', label: 'Type' },
              ]}
              style={styles.segmented}
            />

            {overviewView === 'activity' && (
              <View style={styles.activitySummary}>
                <Text>Total events: {allActivityCounts.totalEvents}</Text>
                <Text>Added: {allActivityCounts.added}</Text>
                <Text>Started: {allActivityCounts.started}</Text>
                <Text>Finished: {allActivityCounts.finished}</Text>
                <Text>DNF: {allActivityCounts.dnf}</Text>
              </View>
            )}

            {overviewView === 'mood' && (
              <View style={styles.activitySummary}>
                {allMoodStats.length === 0 ? (
                  <Text style={styles.muted}>No mood tags recorded yet.</Text>
                ) : (
                  allMoodStats.map((m) => (
                    <View key={m.moodTag} style={styles.rowBetween}>
                      <Text>{m.moodTag.replace('-', ' ')}</Text>
                      <Text>{m.count}</Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {overviewView === 'type' && (
              <View style={styles.activitySummary}>
                {allTypeStats.map((t) => (
                  <View key={t.type} style={styles.rowBetween}>
                    <Text>{t.type === 'book' ? 'Books' : 'Fanfics'}</Text>
                    <Text>{t.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* ---------- DETAILS BY MONTH (WITH PIE + LEGEND) ---------- */}
        <Text variant="titleMedium" style={[styles.sectionHeader, { marginTop: 8 }]}>
          Details by month
        </Text>

        {monthlyBuckets.length === 0 && <Text style={styles.muted}>No activity recorded yet.</Text>}

        {monthlyBuckets.map((bucket, index) => {
          const counts = computeActivityCountsForBucket(bucket);
          const bucketItems = getUniqueItemsForBucket(bucket);
          const bucketMoodStats = computeMoodStats(bucketItems);
          const bucketTypeStats = computeTypeStats(bucketItems);

          const monthView = monthViews[bucket.monthKey] ?? 'activity';

          let monthPieData: PieDatum[];
          switch (monthView) {
            case 'activity':
              monthPieData = buildActivityPieData(counts);
              break;
            case 'mood':
              monthPieData = buildMoodPieData(bucketMoodStats);
              break;
            case 'type':
              monthPieData = buildTypePieData(bucketTypeStats);
              break;
            default:
              monthPieData = [];
          }

          const initiallyCollapsed = index > 0; // latest month open by default

          return (
            <CollapsibleCard
              key={bucket.monthKey}
              initiallyCollapsed={initiallyCollapsed}
              title={`${bucket.label} – ${counts.totalEvents} event${
                counts.totalEvents === 1 ? '' : 's'
              }`}
            >
              <Text style={styles.subLabel}>View</Text>
              <SegmentedButtons
                value={monthView}
                onValueChange={(v) =>
                  setMonthViews((prev) => ({
                    ...prev,
                    [bucket.monthKey]: v as StatsView,
                  }))
                }
                buttons={[
                  { value: 'activity', label: 'Activity' },
                  { value: 'mood', label: 'Mood' },
                  { value: 'type', label: 'Type' },
                ]}
                style={styles.segmented}
              />

              <View style={{ marginTop: 8 }}>
                <StatsPieChart data={monthPieData} />
              </View>

              {/* Per-month textual breakdown depending on view, but
               *not* repeating what the legend already shows. */}
              {monthView === 'activity' && (
                <>
                  <View style={styles.activitySummary}>
                    <Text>Total events: {counts.totalEvents}</Text>
                  </View>

                  {(() => {
                    const sections: {
                      title: string;
                      items: ReadableItem[];
                    }[] = [
                      { title: 'Added to library', items: bucket.added },
                      { title: 'Started reading', items: bucket.started },
                      { title: 'Marked as finished', items: bucket.finished },
                      { title: 'Marked as DNF', items: bucket.dnf },
                    ];

                    const hasAny = sections.some((s) => s.items.length > 0);

                    if (!hasAny) {
                      return <Text style={styles.muted}>No activity for this month.</Text>;
                    }

                    return (
                      <View style={{ marginTop: 8 }}>
                        {sections.map(
                          (section) =>
                            section.items.length > 0 && (
                              <View key={section.title} style={styles.monthGroup}>
                                <Text style={styles.monthTitle}>
                                  {section.title} ({section.items.length})
                                </Text>
                                {section.items.map((item) => (
                                  <View
                                    key={`${section.title}-${item.id}`}
                                    style={styles.finishedItemRow}
                                  >
                                    <Text style={styles.finishedItemTitle}>{item.title}</Text>
                                    <Text style={styles.finishedItemMeta}>
                                      {item.type === 'book' ? 'Book' : 'Fanfic'} • {item.author}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ),
                        )}
                      </View>
                    );
                  })()}
                </>
              )}

              {monthView === 'mood' && (
                <View style={styles.activitySummary}>
                  {bucketMoodStats.length === 0 && (
                    <Text style={styles.muted}>No mood tags recorded this month.</Text>
                  )}
                  {/* Counts per mood are already shown via the pie legend */}
                </View>
              )}

              {monthView === 'type' && (
                <View style={styles.activitySummary}>
                  {bucketTypeStats.length === 0 && (
                    <Text style={styles.muted}>No items this month.</Text>
                  )}
                  {/* Per-type counts already shown in legend */}
                </View>
              )}
            </CollapsibleCard>
          );
        })}
      </ScrollView>
    );
  }

  return <Screen>{content}</Screen>;
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
  rowBetweenTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  snapshotColumn: {
    flex: 1,
  },
  snapshotHeading: {
    fontWeight: '600',
    marginBottom: 2,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
  },
  segmented: {
    marginTop: 4,
  },
  activitySummary: {
    marginTop: 12,
  },
  muted: {
    marginTop: 8,
    opacity: 0.7,
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
