// src/features/readables/ui/ReadableDetailScreen.tsx
// §9 — Full detail screen.
//
// Display order (§9):
//   title · author · kind/source · status (inline) · progress (inline) ·
//   isComplete (AO3 fanfic only) · summary · tags (collapsed) · dateAdded
//
// Actions:
//   - Edit: navigates to AddEditReadable with { id }
//   - Inline status: SegmentedButtons with optimistic local state for instant
//     feel (§13); reverts on error + snackbar.
//   - Inline progress: opens ProgressEditor modal (RHF + Zod); modal stays open
//     on save error so the user can retry without re-entering values; error shown
//     inline; success closes modal.
//   - "View on AO3": only when kind = "fanfic" AND sourceUrl starts with
//     "https://archiveofourown.org/"; uses expo-linking; try/catch → snackbar.
//   - Delete: ConfirmDialog → useDeleteReadable → navigation.goBack().
//
// Snackbar: uses shared useSnackbar hook — one snackbar instance for all
// transient errors on this screen (status update, AO3 link, delete).
//
// Divider strategy: each conditional section (isComplete, summary, tags) owns
// its preceding Divider so there are never two consecutive Dividers.
// Always-present sections (dateAdded, actions) have unconditional Dividers before them.

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
} from 'react-native-paper';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import type { ReadableStatus } from '../domain/readable';
import { READABLE_STATUSES } from '../domain/readable';
import { useReadable } from '../hooks/useReadable';
import { useUpdateReadable } from '../hooks/useUpdateReadable';
import { useDeleteReadable } from '../hooks/useDeleteReadable';
import { ProgressEditor } from './ProgressEditor';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'ReadableDetail'>;

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want',
  reading: 'Reading',
  completed: 'Done',
  dnf: 'DNF',
};

const KIND_LABELS = {
  book: 'Book',
  fanfic: 'Fanfic',
} as const;

const SOURCE_TYPE_LABELS = {
  manual: 'Manual entry',
  ao3: 'AO3',
  book_provider: 'Google Books',
} as const;

/** Number of tags shown collapsed before the "Show N more" toggle appears. */
const PREVIEW_TAG_COUNT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProgress(
  progressCurrent: number | null,
  progressTotal: number | null,
  progressUnit: string,
): string {
  if (progressCurrent === null && progressTotal === null) {
    return 'No progress recorded';
  }
  const current = progressCurrent !== null ? String(progressCurrent) : '--';
  const total = progressTotal !== null ? String(progressTotal) : '?';
  return `${current} / ${total} ${progressUnit}`;
}

/**
 * Formats a stored localMidnightUTC ISO string as a human-readable date.
 * The repository invariant guarantees local Date methods return the correct
 * calendar date (same guarantee used by isoToLocalDate in AddEditScreen).
 */
function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReadableDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useAppTheme();

  // ── Data ──────────────────────────────────────────────────────────────────

  const { readable, isLoading, isError, error, refetch } = useReadable(id);

  // ── Mutations ─────────────────────────────────────────────────────────────
  // Single useUpdateReadable instance shared for both status and progress updates.

  const { update, isPending: isUpdating } = useUpdateReadable();
  const { remove, isPending: isDeleting } = useDeleteReadable();

  // ── UI state ─────────────────────────────────────────────────────────────

  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [progressEditorVisible, setProgressEditorVisible] = useState(false);
  const [progressEditorError, setProgressEditorError] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // ── Optimistic status ─────────────────────────────────────────────────────
  // localStatus: the immediately-displayed status after a user tap, before the
  // query refetches. null means "trust the query data". Set to the new status on
  // tap; reverted to null (falling back to readable.status) when the query
  // confirms the change or when the mutation errors.
  //
  // Sync: whenever readable.status changes (query refetched after any write),
  // drop the optimistic override — the query is now the source of truth.

  const [localStatus, setLocalStatus] = useState<ReadableStatus | null>(null);

  useEffect(() => {
    setLocalStatus(null);
  }, [readable?.status]);

  const displayStatus: ReadableStatus = localStatus ?? readable?.status ?? 'want_to_read';

  // ── Dynamic header title ──────────────────────────────────────────────────

  useEffect(() => {
    if (readable) {
      navigation.setOptions({ title: readable.title });
    }
  }, [navigation, readable?.title]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleEdit() {
    navigation.navigate('AddEditReadable', { id });
  }

  function handleStatusChange(newStatus: ReadableStatus) {
    if (!readable || newStatus === displayStatus || isUpdating) return;
    setLocalStatus(newStatus);
    update(
      { id: readable.id, input: { status: newStatus }, current: readable },
      {
        onError: (err) => {
          // Revert optimistic update — readable.status still holds the old value.
          setLocalStatus(null);
          showSnackbar(err.message);
        },
      },
    );
  }

  function handleProgressSave(
    progressCurrent: number | null,
    progressTotal: number | null,
  ) {
    if (!readable) return;
    // Clear any previous save error before retrying.
    setProgressEditorError(null);
    update(
      {
        id: readable.id,
        input: { progressCurrent, progressTotal },
        current: readable,
      },
      {
        onSuccess: () => {
          setProgressEditorVisible(false);
          setProgressEditorError(null);
        },
        // Do NOT close modal on error — keep the user's values so they can retry.
        onError: (err) => setProgressEditorError(err.message),
      },
    );
  }

  function handleProgressEditorDismiss() {
    setProgressEditorVisible(false);
    setProgressEditorError(null);
  }

  async function handleViewOnAo3() {
    if (!readable?.sourceUrl) return;
    try {
      await Linking.openURL(readable.sourceUrl);
    } catch {
      showSnackbar('Could not open the AO3 link.');
    }
  }

  function handleDeleteConfirm() {
    if (!readable) return;
    remove(
      { id: readable.id },
      {
        onSuccess: () => navigation.goBack(),
        onError: (err) => {
          setConfirmDeleteVisible(false);
          showSnackbar(err.message);
        },
      },
    );
  }

  // ── Loading / error / not-found states ───────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text
          variant="bodyMedium"
          style={[styles.centeredMessage, { color: theme.colors.textSecondary }]}
        >
          {error?.message ?? 'Failed to load readable.'}
        </Text>
        <Button mode="outlined" onPress={refetch}>
          Try again
        </Button>
      </View>
    );
  }

  if (!readable) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyMedium" style={{ color: theme.colors.textSecondary }}>
          Readable not found.
        </Text>
      </View>
    );
  }

  // ── Derived display values ────────────────────────────────────────────────

  const isAo3LinkValid =
    readable.kind === 'fanfic' &&
    typeof readable.sourceUrl === 'string' &&
    readable.sourceUrl.startsWith('https://archiveofourown.org/');

  const previewTags = tagsExpanded
    ? readable.tags
    : readable.tags.slice(0, PREVIEW_TAG_COUNT);

  const hiddenTagCount = readable.tags.length - PREVIEW_TAG_COUNT;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.textPrimary }]}
        >
          {readable.title}
        </Text>

        {/* ── Author ─────────────────────────────────────────────────────── */}
        {readable.author !== null && (
          <Text
            variant="titleMedium"
            style={[styles.author, { color: theme.colors.textSecondary }]}
          >
            {readable.author}
          </Text>
        )}

        <Divider style={styles.divider} />

        {/* ── Kind / Source ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            KIND
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {KIND_LABELS[readable.kind]}
            {'  ·  '}
            {SOURCE_TYPE_LABELS[readable.sourceType]}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* ── Status ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            STATUS
          </Text>
          {/*
            displayStatus is the optimistic value — updates instantly on tap.
            Falls back to readable.status once the query refetches.
            Buttons are disabled while isUpdating to prevent double-firing.
          */}
          <SegmentedButtons
            value={displayStatus}
            onValueChange={(v) => handleStatusChange(v as ReadableStatus)}
            buttons={READABLE_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
              disabled: isUpdating,
            }))}
          />
        </View>

        <Divider style={styles.divider} />

        {/* ── Progress ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            PROGRESS
          </Text>
          <View style={styles.progressRow}>
            <Text
              variant="bodyMedium"
              style={[styles.progressText, { color: theme.colors.textPrimary }]}
            >
              {formatProgress(
                readable.progressCurrent,
                readable.progressTotal,
                readable.progressUnit,
              )}
            </Text>
            <Button
              compact
              mode="outlined"
              onPress={() => setProgressEditorVisible(true)}
              disabled={isUpdating}
              accessibilityLabel="Edit progress"
            >
              Edit
            </Button>
          </View>
        </View>

        {/* ── isComplete (AO3 fanfic only) ───────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.isComplete !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                COMPLETION
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {readable.isComplete ? 'Complete' : 'WIP (work in progress)'}
              </Text>
            </View>
          </>
        )}

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        {readable.summary !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                SUMMARY
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {readable.summary}
              </Text>
            </View>
          </>
        )}

        {/* ── Tags ────────────────────────────────────────────────────────── */}
        {readable.tags.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                TAGS
              </Text>
              <View style={styles.tagRow}>
                {previewTags.map((tag) => (
                  <Chip key={tag} compact style={styles.tag}>
                    {tag}
                  </Chip>
                ))}
              </View>
              {hiddenTagCount > 0 && (
                <Button
                  compact
                  mode="text"
                  onPress={() => setTagsExpanded((prev) => !prev)}
                  style={styles.tagToggle}
                  accessibilityLabel={tagsExpanded ? 'Show fewer tags' : 'Show all tags'}
                >
                  {tagsExpanded ? 'Show less' : `+${hiddenTagCount} more`}
                </Button>
              )}
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* ── Date Added ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            DATE ADDED
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {formatDisplayDate(readable.dateAdded)}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleEdit}
            accessibilityLabel="Edit readable"
          >
            Edit
          </Button>

          {isAo3LinkValid && (
            <Button
              mode="outlined"
              onPress={handleViewOnAo3}
              accessibilityLabel="View on AO3"
            >
              View on AO3
            </Button>
          )}

          <Button
            mode="outlined"
            onPress={() => setConfirmDeleteVisible(true)}
            textColor={theme.colors.error}
            disabled={isDeleting}
            accessibilityLabel="Delete readable"
          >
            Delete
          </Button>
        </View>

      </ScrollView>

      {/* ── Progress editor modal ────────────────────────────────────────── */}
      <ProgressEditor
        visible={progressEditorVisible}
        readable={readable}
        isSaving={isUpdating}
        errorMessage={progressEditorError ?? undefined}
        onDismiss={handleProgressEditorDismiss}
        onSave={handleProgressSave}
      />

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Delete readable"
        message={`Remove "${readable.title}" from your library? This cannot be undone.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  centeredMessage: {
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 4,
  },
  author: {
    marginBottom: 4,
  },
  divider: {
    marginVertical: 12,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    // Paper's labelSmall variant handles sizing; color applied inline
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    // Paper handles chip sizing via compact prop
  },
  tagToggle: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
});
