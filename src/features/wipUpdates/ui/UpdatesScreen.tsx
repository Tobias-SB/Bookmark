// src/features/wipUpdates/ui/UpdatesScreen.tsx
// UI Phase 6 — UpdatesScreen redesign.
// Notification inbox for WIP update records.
//
// Layout:
//   - Header right: "Check for Updates" styled button (ActivityIndicator while pending)
//   - FlatList with bulk action row as ListHeaderComponent
//   - Each card: floating card with left accent strip; unread vs read styling
//   - ConfirmDialog for "Clear all"
//   - Snackbar for check results and errors

import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ActivityIndicator,
  Portal,
  Snackbar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useAppTheme } from '../../../app/theme';
import type { TabParamList } from '../../../app/navigation/types';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';

import type { WipUpdate } from '../domain/wipUpdate';
import { useWipUpdates } from '../hooks/useWipUpdates';
import { useCheckWipUpdates } from '../hooks/useCheckWipUpdates';
import { useMarkWipUpdateRead } from '../hooks/useMarkWipUpdateRead';
import { useMarkAllWipUpdatesRead } from '../hooks/useMarkAllWipUpdatesRead';
import { useDeleteWipUpdate } from '../hooks/useDeleteWipUpdate';
import { useClearWipUpdates, type ClearMode } from '../hooks/useClearWipUpdates';
import { summarizeWipUpdate } from '../services/summarizeWipUpdate';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = BottomTabScreenProps<TabParamList, 'Updates'>;

// ── Diff row sub-component ────────────────────────────────────────────────────

interface DiffRowProps {
  label: string;
  before: string;
  after: string;
}

function DiffRow({ label, before, after }: DiffRowProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.diffRow}>
      <Text style={[styles.diffLabel, { color: theme.colors.textMeta }]}>
        {label}
      </Text>
      <View style={styles.diffValues}>
        <Text style={{ color: theme.colors.textMeta, textDecorationLine: 'line-through', fontSize: 13 }}>
          {before}
        </Text>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 13 }}>
          {after}
        </Text>
      </View>
    </View>
  );
}

// ── Diff section — list of added/removed strings ──────────────────────────────

interface DiffListRowProps {
  label: string;
  added: string[];
  removed: string[];
}

function DiffListRow({ label, added, removed }: DiffListRowProps) {
  const theme = useAppTheme();
  if (added.length === 0 && removed.length === 0) return null;
  return (
    <View style={styles.diffRow}>
      <Text style={[styles.diffLabel, { color: theme.colors.textMeta }]}>
        {label}
      </Text>
      <View style={styles.diffChips}>
        {added.map(item => (
          <View
            key={`add-${item}`}
            style={[styles.diffChip, { backgroundColor: theme.colors.statusCompletedBg, borderColor: theme.colors.statusCompletedBorder }]}
          >
            <Text style={{ color: theme.colors.statusCompletedText, fontSize: 11, fontWeight: '500' }}>
              + {item}
            </Text>
          </View>
        ))}
        {removed.map(item => (
          <View
            key={`rem-${item}`}
            style={[styles.diffChip, { backgroundColor: theme.colors.dangerSubtle, borderColor: theme.colors.dangerBorder }]}
          >
            <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: '500' }}>
              – {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Expanded diff ─────────────────────────────────────────────────────────────

function ExpandedDiff({ update }: { update: WipUpdate }) {
  const theme = useAppTheme();

  const rows: React.ReactElement[] = [];

  if (update.statusReverted) {
    rows.push(
      <View key="reverted" style={styles.diffRow}>
        <Text style={{ color: theme.colors.danger, fontSize: 13 }}>
          Status reverted: Completed → Reading (new chapters added)
        </Text>
      </View>,
    );
  }

  if (!update.previousIsComplete && update.fetchedIsComplete === true) {
    rows.push(
      <View key="complete" style={styles.diffRow}>
        <Text style={{ color: theme.colors.statusCompletedText, fontSize: 13 }}>
          Marked complete
        </Text>
      </View>,
    );
  }

  if (
    update.fetchedAvailableChapters !== null &&
    update.fetchedAvailableChapters !== update.previousAvailableChapters
  ) {
    rows.push(
      <DiffRow
        key="chapters"
        label="Available chapters"
        before={update.previousAvailableChapters?.toString() ?? '—'}
        after={update.fetchedAvailableChapters.toString()}
      />,
    );
  }

  if (
    update.fetchedTotalUnits !== null &&
    update.fetchedTotalUnits !== update.previousTotalUnits
  ) {
    rows.push(
      <DiffRow
        key="total"
        label="Total chapters"
        before={update.previousTotalUnits?.toString() ?? '?'}
        after={update.fetchedTotalUnits.toString()}
      />,
    );
  }

  if (
    update.fetchedWordCount !== null &&
    update.fetchedWordCount !== update.previousWordCount
  ) {
    rows.push(
      <DiffRow
        key="words"
        label="Word count"
        before={update.previousWordCount?.toLocaleString() ?? '—'}
        after={update.fetchedWordCount.toLocaleString()}
      />,
    );
  }

  if (
    update.fetchedSeriesTotal !== null &&
    update.fetchedSeriesTotal !== update.previousSeriesTotal
  ) {
    rows.push(
      <DiffRow
        key="series"
        label="Series total"
        before={update.previousSeriesTotal?.toString() ?? '—'}
        after={update.fetchedSeriesTotal.toString()}
      />,
    );
  }

  const addedTags = update.fetchedTags.filter(t => !update.previousTags.includes(t));
  const removedTags = update.previousTags.filter(t => !update.fetchedTags.includes(t));
  if (addedTags.length > 0 || removedTags.length > 0) {
    rows.push(
      <DiffListRow key="tags" label="Tags" added={addedTags} removed={removedTags} />,
    );
  }

  const addedRel = update.fetchedRelationships.filter(
    r => !update.previousRelationships.includes(r),
  );
  const removedRel = update.previousRelationships.filter(
    r => !update.fetchedRelationships.includes(r),
  );
  if (addedRel.length > 0 || removedRel.length > 0) {
    rows.push(
      <DiffListRow
        key="rel"
        label="Relationships"
        added={addedRel}
        removed={removedRel}
      />,
    );
  }

  const addedWarn = update.fetchedArchiveWarnings.filter(
    w => !update.previousArchiveWarnings.includes(w),
  );
  const removedWarn = update.previousArchiveWarnings.filter(
    w => !update.fetchedArchiveWarnings.includes(w),
  );
  if (addedWarn.length > 0 || removedWarn.length > 0) {
    rows.push(
      <DiffListRow
        key="warn"
        label="Warnings"
        added={addedWarn}
        removed={removedWarn}
      />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <View style={[styles.expandedDiff, { borderTopColor: theme.colors.backgroundBorder }]}>
      {rows}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function UpdatesScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  // Local state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearConfirmMode, setClearConfirmMode] = useState<ClearMode | null>(null);

  // Hooks
  const { updates, isLoading } = useWipUpdates();
  const { checkAsync, isPending: isChecking } = useCheckWipUpdates();
  const { markRead } = useMarkWipUpdateRead();
  const { markAllRead, isPending: isMarkingAllRead } = useMarkAllWipUpdatesRead();
  const { remove } = useDeleteWipUpdate();
  const { clear, isPending: isClearing } = useClearWipUpdates();

  const hasUpdates = updates.length > 0;
  const hasUnread = updates.some(u => u.status === 'unread');
  const hasRead = updates.some(u => u.status === 'read');

  // ── Check for updates ───────────────────────────────────────────────────────

  const handleCheckPress = useCallback(async () => {
    try {
      const result = await checkAsync();
      if (result.checked === 0) {
        showSnackbar('No eligible works to check');
      } else if (result.updated === 0) {
        const w = result.checked === 1 ? 'work' : 'works';
        showSnackbar(`Checked ${result.checked} ${w} — no updates`);
      } else {
        const w = result.checked === 1 ? 'work' : 'works';
        showSnackbar(`Checked ${result.checked} ${w} — ${result.updated} updated`);
      }
    } catch {
      showSnackbar('Could not check for updates — check your connection and try again');
    }
  }, [checkAsync, showSnackbar]);

  // ── Header right ─────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        isChecking ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.kindBook}
            style={styles.headerSpinner}
          />
        ) : (
          <TouchableOpacity
            onPress={handleCheckPress}
            style={[
              styles.checkButton,
              {
                backgroundColor: theme.colors.kindBookSubtle,
                borderColor: theme.colors.kindBookBorder,
              },
            ]}
            accessibilityLabel="Check for updates"
            accessibilityRole="button"
          >
            <Text style={[styles.checkButtonText, { color: theme.colors.kindBook }]}>
              Check now
            </Text>
          </TouchableOpacity>
        ),
    });
  }, [navigation, isChecking, handleCheckPress, theme]);

  // ── Card press ───────────────────────────────────────────────────────────────

  const handleCardPress = useCallback(
    (update: WipUpdate) => {
      setExpandedId(prev => (prev === update.id ? null : update.id));
    },
    [],
  );

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  const handleClearConfirm = useCallback(() => {
    if (!clearConfirmMode) return;
    clear(clearConfirmMode, {
      onSettled: () => setClearConfirmMode(null),
    });
  }, [clear, clearConfirmMode]);

  // ── Render card ───────────────────────────────────────────────────────────────

  const renderCard = useCallback(
    ({ item }: { item: WipUpdate }) => {
      const isUnread = item.status === 'unread';
      const isExpanded = expandedId === item.id;

      return (
        <TouchableOpacity
          onPress={() => handleCardPress(item)}
          activeOpacity={0.85}
          style={[
            styles.card,
            isUnread
              ? {
                  backgroundColor: theme.colors.backgroundCard,
                  borderWidth: 0,
                  ...theme.shadows.card,
                }
              : {
                  backgroundColor: theme.colors.backgroundInput,
                  borderWidth: 1,
                  borderColor: theme.colors.backgroundBorder,
                },
          ]}
          accessibilityLabel={`Update for ${item.readableTitle}${isUnread ? ', unread' : ''}`}
          accessibilityRole="button"
        >
          {/* Left accent strip */}
          <View
            style={[
              styles.cardAccent,
              {
                backgroundColor: isUnread
                  ? theme.colors.kindBook
                  : theme.colors.backgroundBorder,
              },
            ]}
          />

          {/* Card body */}
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitles}>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: theme.colors.textPrimary,
                      fontWeight: isUnread ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.readableTitle}
                </Text>
                {item.readableAuthor ? (
                  <Text
                    style={[styles.cardAuthor, { color: theme.colors.textBody }]}
                    numberOfLines={1}
                  >
                    {item.readableAuthor}
                  </Text>
                ) : null}
              </View>
              {isUnread ? (
                <View style={[styles.unreadDot, { backgroundColor: theme.colors.kindBook }]} />
              ) : null}
            </View>

            <Text
              style={[
                styles.cardSummary,
                { color: isUnread ? theme.colors.textBody : theme.colors.textMeta },
              ]}
            >
              {summarizeWipUpdate(item)}
            </Text>

            <Text style={[styles.cardDate, { color: theme.colors.textMeta }]}>
              {new Date(item.checkedAt).toLocaleString()}
            </Text>

            {isExpanded ? <ExpandedDiff update={item} /> : null}

            {/* Card footer */}
            <View style={[styles.cardFooter, { borderTopColor: theme.colors.backgroundBorder }]}>
              {isUnread ? (
                <Text style={[styles.expandHint, { color: theme.colors.textMeta }]}>
                  {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
                </Text>
              ) : (
                <Text style={[styles.expandHint, { color: theme.colors.textMeta }]}>
                  {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
                </Text>
              )}
              <View style={styles.cardFooterActions}>
                {isUnread ? (
                  <TouchableOpacity
                    onPress={() => markRead(item.id)}
                    style={styles.markReadButton}
                    accessibilityLabel={`Mark update for ${item.readableTitle} as read`}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.markReadText, { color: theme.colors.kindBook }]}>
                      Mark read
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => {
                    remove(item.id);
                    if (expandedId === item.id) setExpandedId(null);
                  }}
                  style={styles.deleteButton}
                  accessibilityLabel={`Delete update for ${item.readableTitle}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.deleteButtonText, { color: theme.colors.danger }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [expandedId, handleCardPress, markRead, remove, theme],
  );

  // ── List header ───────────────────────────────────────────────────────────────

  const renderListHeader = useCallback(() => {
    if (!hasUpdates) return null;
    return (
      <View style={[styles.bulkRow, { borderBottomColor: theme.colors.backgroundBorder }]}>
        {hasUnread ? (
          <TouchableOpacity
            onPress={() => markAllRead()}
            disabled={isMarkingAllRead}
            style={[
              styles.bulkButton,
              {
                backgroundColor: theme.colors.backgroundInput,
                borderColor: theme.colors.backgroundBorder,
                opacity: isMarkingAllRead ? 0.5 : 1,
              },
            ]}
            accessibilityLabel="Mark all updates as read"
            accessibilityRole="button"
          >
            <Text style={[styles.bulkButtonText, { color: theme.colors.textBody }]}>
              Mark all read
            </Text>
          </TouchableOpacity>
        ) : null}
        {hasRead ? (
          <TouchableOpacity
            onPress={() => clear('read')}
            disabled={isClearing}
            style={[
              styles.bulkButton,
              {
                backgroundColor: theme.colors.backgroundInput,
                borderColor: theme.colors.backgroundBorder,
                opacity: isClearing ? 0.5 : 1,
              },
            ]}
            accessibilityLabel="Clear read updates"
            accessibilityRole="button"
          >
            <Text style={[styles.bulkButtonText, { color: theme.colors.textBody }]}>
              Clear read
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => setClearConfirmMode('all')}
          disabled={isClearing}
          style={[
            styles.bulkButton,
            {
              backgroundColor: theme.colors.dangerSubtle,
              borderColor: theme.colors.dangerBorder,
              opacity: isClearing ? 0.5 : 1,
            },
          ]}
          accessibilityLabel="Clear all updates"
          accessibilityRole="button"
        >
          <Text style={[styles.bulkButtonText, { color: theme.colors.danger }]}>
            Clear all
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [hasUpdates, hasUnread, hasRead, markAllRead, isMarkingAllRead, clear, isClearing, theme]);

  // ── Empty state ───────────────────────────────────────────────────────────────

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.kindBook} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.textBody }]}>
          No updates yet
        </Text>
        <Text style={[styles.emptyBody, { color: theme.colors.textMeta }]}>
          Tap "Check now" to check your WIP fanfics for updates
        </Text>
      </View>
    );
  }, [isLoading, theme]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}>
      <FlatList
        data={updates}
        keyExtractor={item => item.id}
        renderItem={renderCard}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          !hasUpdates && styles.listContentEmpty,
        ]}
        removeClippedSubviews={false}
      />

      <ConfirmDialog
        visible={clearConfirmMode === 'all'}
        title="Clear all updates"
        message="This will permanently delete all update records. This cannot be undone."
        confirmLabel="Clear all"
        loading={isClearing}
        onConfirm={handleClearConfirm}
        onCancel={() => setClearConfirmMode(null)}
      />

      <Portal>
        <Snackbar
          visible={snackbarMessage !== null}
          onDismiss={hideSnackbar}
          duration={4000}
        >
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  bulkButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    flexDirection: 'row',
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitles: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
  },
  cardAuthor: {
    fontSize: 13,
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  cardSummary: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  expandHint: {
    fontSize: 11,
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markReadButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  expandedDiff: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    gap: 8,
  },
  diffRow: {
    gap: 2,
  },
  diffLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diffValues: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  diffChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  diffChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerSpinner: {
    marginRight: 16,
  },
  checkButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  checkButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
