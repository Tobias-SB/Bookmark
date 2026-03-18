// src/features/wipUpdates/ui/UpdatesScreen.tsx
// Notification inbox for WIP update records.
//
// Layout:
//   - Header right: "Check for Updates" icon button (ActivityIndicator while pending)
//   - FlatList with bulk action row as ListHeaderComponent
//   - Each card: title, author, summary, checkedAt date; tap to expand diff + mark read
//   - ConfirmDialog for "Clear all"
//   - Snackbar for check results and errors

import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Portal,
  Snackbar,
  Text,
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
      <Text
        variant="labelSmall"
        style={[styles.diffLabel, { color: theme.colors.textSecondary }]}
      >
        {label}
      </Text>
      <View style={styles.diffValues}>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.textSecondary, textDecorationLine: 'line-through' }}
        >
          {before}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.textPrimary }}>
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
      <Text
        variant="labelSmall"
        style={[styles.diffLabel, { color: theme.colors.textSecondary }]}
      >
        {label}
      </Text>
      <View style={styles.diffChips}>
        {added.map(item => (
          <Chip
            key={`add-${item}`}
            compact
            style={[styles.diffChip, { backgroundColor: theme.colors.primaryContainer }]}
            textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 11 }}
          >
            + {item}
          </Chip>
        ))}
        {removed.map(item => (
          <Chip
            key={`rem-${item}`}
            compact
            style={[styles.diffChip, { backgroundColor: theme.colors.errorContainer }]}
            textStyle={{ color: theme.colors.onErrorContainer, fontSize: 11 }}
          >
            – {item}
          </Chip>
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
        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
          Status reverted: Completed → Reading (new chapters added)
        </Text>
      </View>,
    );
  }

  if (!update.previousIsComplete && update.fetchedIsComplete === true) {
    rows.push(
      <View key="complete" style={styles.diffRow}>
        <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
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
    <View style={[styles.expandedDiff, { borderTopColor: theme.colors.outlineVariant }]}>
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
            color={theme.colors.primary}
            style={styles.headerSpinner}
          />
        ) : (
          <Button
            mode="text"
            onPress={handleCheckPress}
            textColor={theme.colors.primary}
            style={styles.headerButton}
            accessibilityLabel="Check for updates"
          >
            Check for Updates
          </Button>
        ),
    });
  }, [navigation, isChecking, handleCheckPress, theme.colors.primary]);

  // ── Card press ───────────────────────────────────────────────────────────────

  const handleCardPress = useCallback(
    (update: WipUpdate) => {
      if (update.status === 'unread') {
        markRead(update.id);
      }
      setExpandedId(prev => (prev === update.id ? null : update.id));
    },
    [markRead],
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
      const cardBg = isUnread ? theme.colors.primaryContainer : theme.colors.surface;

      return (
        <Card
          style={[styles.card, { backgroundColor: cardBg }]}
          onPress={() => handleCardPress(item)}
          accessibilityLabel={`Update for ${item.readableTitle}${isUnread ? ', unread' : ''}`}
          accessibilityRole="button"
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitles}>
                <Text
                  variant="titleSmall"
                  style={[
                    { color: isUnread ? theme.colors.onPrimaryContainer : theme.colors.textPrimary },
                    isUnread && styles.unreadTitle,
                  ]}
                  numberOfLines={1}
                >
                  {item.readableTitle}
                </Text>
                {item.readableAuthor ? (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: isUnread
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    {item.readableAuthor}
                  </Text>
                ) : null}
              </View>
              {isUnread ? (
                <View
                  style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]}
                />
              ) : null}
            </View>

            <Text
              variant="bodySmall"
              style={{
                color: isUnread ? theme.colors.onPrimaryContainer : theme.colors.textSecondary,
                marginTop: 4,
              }}
            >
              {summarizeWipUpdate(item)}
            </Text>

            <Text
              variant="labelSmall"
              style={{
                color: isUnread ? theme.colors.onPrimaryContainer : theme.colors.textDisabled,
                marginTop: 4,
              }}
            >
              {new Date(item.checkedAt).toLocaleString()}
            </Text>

            {isExpanded ? <ExpandedDiff update={item} /> : null}
          </Card.Content>

          {/* Swipe-to-delete stub: single delete button in expanded view */}
          {isExpanded ? (
            <View>
              <Divider style={{ backgroundColor: theme.colors.outlineVariant }} />
              <Card.Actions style={styles.cardActions}>
                <Button
                  compact
                  textColor={theme.colors.error}
                  onPress={() => {
                    remove(item.id);
                    if (expandedId === item.id) setExpandedId(null);
                  }}
                  accessibilityLabel={`Delete update for ${item.readableTitle}`}
                >
                  Delete
                </Button>
              </Card.Actions>
            </View>
          ) : null}
        </Card>
      );
    },
    [expandedId, handleCardPress, remove, theme],
  );

  // ── List header ───────────────────────────────────────────────────────────────

  const renderListHeader = useCallback(() => {
    if (!hasUpdates) return null;
    return (
      <View style={[styles.bulkRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        {hasUnread ? (
          <Button
            compact
            mode="text"
            onPress={() => markAllRead()}
            loading={isMarkingAllRead}
            disabled={isMarkingAllRead}
            accessibilityLabel="Mark all updates as read"
          >
            Mark all read
          </Button>
        ) : null}
        {hasRead ? (
          <Button
            compact
            mode="text"
            onPress={() => clear('read')}
            disabled={isClearing}
            accessibilityLabel="Clear read updates"
          >
            Clear read
          </Button>
        ) : null}
        <Button
          compact
          mode="text"
          textColor={theme.colors.error}
          onPress={() => setClearConfirmMode('all')}
          disabled={isClearing}
          accessibilityLabel="Clear all updates"
        >
          Clear all
        </Button>
      </View>
    );
  }, [hasUpdates, hasUnread, hasRead, markAllRead, isMarkingAllRead, clear, isClearing, theme]);

  // ── Empty state ───────────────────────────────────────────────────────────────

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text
          variant="bodyLarge"
          style={[styles.emptyTitle, { color: theme.colors.textSecondary }]}
        >
          No updates yet
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.textDisabled, textAlign: 'center' }}
        >
          Tap "Check for Updates" to check your WIP fanfics for updates
        </Text>
      </View>
    );
  }, [isLoading, theme]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 4,
  },
  card: {
    marginBottom: 8,
    borderRadius: 12,
  },
  cardContent: {
    paddingTop: 12,
    paddingBottom: 16,
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
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  expandedDiff: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  diffRow: {
    gap: 2,
  },
  diffLabel: {
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
  diffChip: {},
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  headerSpinner: {
    marginRight: 16,
  },
  headerButton: {
    marginRight: 8,
  },
});
