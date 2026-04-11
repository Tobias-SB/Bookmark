// src/features/wipUpdates/ui/UpdatesScreen.tsx
// UI Phase 6 — UpdatesScreen redesign (V3: progress and scope).
// Notification inbox for WIP update records.
//
// Layout:
//   - Scope section above FlatList (hidden during check): status chips, abandoned
//     toggle, check button
//   - Progress card replaces scope section during an active check
//   - FlatList with bulk action row as ListHeaderComponent
//   - Each card: floating card with left accent strip; unread vs read styling
//   - ConfirmDialog for "Clear all"
//   - Snackbar for check results and errors

import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Portal, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useAppTheme } from '../../../app/theme';
import type { TabParamList } from '../../../app/navigation/types';
import type { ReadableStatus } from '../../readables';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
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

// ── Constants ─────────────────────────────────────────────────────────────────

const SCOPE_STATUSES: ReadableStatus[] = ['reading', 'want_to_read'];

const STATUS_LABELS: Record<ReadableStatus, string> = {
  reading: 'Reading',
  want_to_read: 'Want to Read',
  completed: 'Completed',
  dnf: 'DNF',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function checkButtonLabel(statuses: ReadableStatus[]): string {
  if (statuses.length === 1 && statuses[0] === 'reading') return 'Check reading WIPs';
  if (statuses.length === SCOPE_STATUSES.length) return 'Check all WIPs';
  return 'Check selected WIPs';
}

function roundEstimate(seconds: number): number {
  if (seconds < 60) return Math.max(5, Math.round(seconds / 5) * 5);
  return Math.round(seconds / 30) * 30;
}

function formatEstimate(seconds: number): string {
  const rounded = roundEstimate(seconds);
  if (rounded < 60) return `About ${rounded} seconds remaining`;
  const mins = Math.round(rounded / 60);
  return `About ${Math.max(1, mins)} minute${mins !== 1 ? 's' : ''} remaining`;
}

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

export function UpdatesScreen(_props: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  // Local UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearConfirmMode, setClearConfirmMode] = useState<ClearMode | null>(null);

  // Scope state
  const [selectedStatuses, setSelectedStatuses] = useState<ReadableStatus[]>(['reading']);
  const [includeAbandoned, setIncludeAbandoned] = useState(false);

  // Hooks
  const { updates, isLoading } = useWipUpdates();
  const { checkAsync, isPending: isChecking, progress, estimatedRemaining } = useCheckWipUpdates();
  const { markRead } = useMarkWipUpdateRead();
  const { markAllRead, isPending: isMarkingAllRead } = useMarkAllWipUpdatesRead();
  const { remove } = useDeleteWipUpdate();
  const { clear, isPending: isClearing } = useClearWipUpdates();

  const hasUpdates = updates.length > 0;
  const hasUnread = updates.some(u => u.status === 'unread');
  const hasRead = updates.some(u => u.status === 'read');

  // Show the abandoned toggle when any non-Reading status is selected
  const showAbandonedToggle = selectedStatuses.some(s => s !== 'reading');

  // ── Status chip toggle ──────────────────────────────────────────────────────

  const handleStatusToggle = useCallback((status: ReadableStatus) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        // Prevent deselecting the last chip
        if (prev.length === 1) return prev;
        const next = prev.filter(s => s !== status);
        // Reset abandoned toggle if no non-Reading statuses remain
        if (!next.some(s => s !== 'reading')) setIncludeAbandoned(false);
        return next;
      }
      return [...prev, status];
    });
  }, []);

  // ── Check for updates ───────────────────────────────────────────────────────

  const handleCheckPress = useCallback(async () => {
    try {
      const result = await checkAsync({ statuses: selectedStatuses, includeAbandoned });
      if (result.checked === 0) {
        showSnackbar(result.emptyReason ?? 'No eligible works to check');
      } else if (result.updated === 0) {
        const w = result.checked === 1 ? 'work' : 'works';
        showSnackbar(`Checked ${result.checked} ${w} — no updates`);
      } else {
        const w = result.checked === 1 ? 'work' : 'works';
        const parts = [`${result.updated} updated`];
        if (result.restricted > 0) {
          parts.push(`${result.restricted} require AO3 login`);
        }
        let message = `Checked ${result.checked} ${w} — ${parts.join(', ')}`;
        if (result.staleSession) {
          message += ' — AO3 session expired, log in again via Settings';
        }
        showSnackbar(message);
      }
    } catch {
      showSnackbar('Could not check for updates — check your connection and try again');
    }
  }, [checkAsync, selectedStatuses, includeAbandoned, showSnackbar]);

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

  // ── Scope section (shown when not checking) ───────────────────────────────

  const renderScopeSection = () => (
    <View style={[styles.scopeSection, { borderBottomColor: theme.colors.backgroundBorder }]}>
      {/* Status chips */}
      <View style={styles.scopeChips}>
        {SCOPE_STATUSES.map(status => {
          const isSelected = selectedStatuses.includes(status);
          const isReading = status === 'reading';
          return (
            <TouchableOpacity
              key={status}
              onPress={() => handleStatusToggle(status)}
              style={[
                styles.scopeChip,
                {
                  backgroundColor: isSelected
                    ? (isReading ? theme.colors.statusReadingBg : theme.colors.backgroundBorder)
                    : theme.colors.backgroundInput,
                  borderColor: isSelected
                    ? (isReading ? theme.colors.statusReadingBorder : theme.colors.outline)
                    : theme.colors.backgroundBorder,
                },
              ]}
              accessibilityLabel={`${STATUS_LABELS[status]} status${isSelected ? ', selected' : ''}`}
              accessibilityRole="checkbox"
            >
              <Text
                style={[
                  styles.scopeChipText,
                  {
                    color: isSelected
                      ? (isReading ? theme.colors.statusReadingText : theme.colors.textPrimary)
                      : theme.colors.textBody,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Include abandoned toggle — only when non-Reading status selected */}
      {showAbandonedToggle ? (
        <View style={styles.abandonedRow}>
          <Text style={[styles.abandonedLabel, { color: theme.colors.textBody }]}>
            Include abandoned
          </Text>
          <Switch
            value={includeAbandoned}
            onValueChange={setIncludeAbandoned}
            trackColor={{
              false: theme.colors.backgroundBorder,
              true: theme.colors.kindBookBorder,
            }}
            thumbColor={includeAbandoned ? theme.colors.kindBook : theme.colors.textMeta}
            accessibilityLabel="Include abandoned fanfics"
          />
        </View>
      ) : null}

      {/* Check button */}
      <TouchableOpacity
        onPress={handleCheckPress}
        style={[
          styles.checkButton,
          {
            backgroundColor: theme.colors.kindBookSubtle,
            borderColor: theme.colors.kindBookBorder,
          },
        ]}
        accessibilityLabel={checkButtonLabel(selectedStatuses)}
        accessibilityRole="button"
      >
        <Text style={[styles.checkButtonText, { color: theme.colors.kindBook }]}>
          {checkButtonLabel(selectedStatuses)}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Progress card (shown during check) ───────────────────────────────────────

  const renderProgressCard = () => {
    if (!progress) {
      return (
        <View style={[styles.progressCard, { borderBottomColor: theme.colors.backgroundBorder }]}>
          <Text style={[styles.progressCountText, { color: theme.colors.textBody }]}>
            Starting check…
          </Text>
        </View>
      );
    }

    const fillPercent = `${(progress.current / progress.total) * 100}%` as `${number}%`;

    let outcomeEl: React.ReactElement | null = null;
    if (progress.outcome === 'updated') {
      outcomeEl = (
        <Text style={[styles.outcomeLabel, { color: theme.colors.kindBook }]}>Updated</Text>
      );
    } else if (progress.outcome === 'unchanged') {
      outcomeEl = (
        <Text style={[styles.outcomeLabel, { color: theme.colors.textMeta }]}>✓</Text>
      );
    } else {
      outcomeEl = (
        <Text style={[styles.outcomeLabel, { color: theme.colors.textMeta }]}>Skipped</Text>
      );
    }

    return (
      <View style={[styles.progressCard, { borderBottomColor: theme.colors.backgroundBorder }]}>
        {/* Progress bar */}
        <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.backgroundBorder }]}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: theme.colors.kindBook, width: fillPercent },
            ]}
          />
        </View>

        {/* Count */}
        <Text style={[styles.progressCountText, { color: theme.colors.textBody }]}>
          {`Checking ${progress.current} of ${progress.total}`}
        </Text>

        {/* Current title + outcome */}
        <View style={styles.progressTitleRow}>
          <Text
            style={[styles.progressTitleText, { color: theme.colors.textBody }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {progress.title}
          </Text>
          {outcomeEl}
        </View>

        {/* Time estimate */}
        {estimatedRemaining !== null ? (
          <Text style={[styles.progressEstimate, { color: theme.colors.textMeta }]}>
            {formatEstimate(estimatedRemaining)}
          </Text>
        ) : null}
      </View>
    );
  };

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
              <Text style={[styles.expandHint, { color: theme.colors.textMeta }]}>
                {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
              </Text>
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
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.textBody }]}>
          No updates yet
        </Text>
        <Text style={[styles.emptyBody, { color: theme.colors.textMeta }]}>
          Tap the check button above to check your WIP fanfics for updates
        </Text>
      </View>
    );
  }, [isLoading, theme]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}>
      <ScreenHeader title="Updates" />

      {/* Scope section / progress card — fixed above the list */}
      {isChecking ? renderProgressCard() : renderScopeSection()}

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

  // ── Scope section ───────────────────────────────────────────────────────────
  scopeSection: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  scopeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipText: {
    fontSize: 13,
  },
  abandonedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  abandonedLabel: {
    fontSize: 14,
  },
  checkButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Progress card ───────────────────────────────────────────────────────────
  progressCard: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressCountText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitleText: {
    flex: 1,
    fontSize: 13,
  },
  outcomeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressEstimate: {
    fontSize: 12,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // ── Bulk row ────────────────────────────────────────────────────────────────
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

  // ── Card ────────────────────────────────────────────────────────────────────
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

  // ── Expanded diff ───────────────────────────────────────────────────────────
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

  // ── Empty state ─────────────────────────────────────────────────────────────
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
});
