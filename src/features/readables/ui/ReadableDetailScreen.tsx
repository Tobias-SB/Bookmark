// src/features/readables/ui/ReadableDetailScreen.tsx
// §9 — Full detail screen.
//
// Display order (§9 + extensions):
//   cover image (books with coverUrl) · title · author · kind/source ·
//   isbn (books with isbn) · status (inline) · progress (inline) ·
//   available chapters (fanfics with availableChapters) ·
//   isComplete (AO3 fanfic only) · summary · tags (collapsed) · dateAdded

import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ReadableDetail'>;

const STATUS_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want',
  reading: 'Reading',
  completed: 'Done',
  dnf: 'DNF',
};

const KIND_LABELS = { book: 'Book', fanfic: 'Fanfic' } as const;
const SOURCE_TYPE_LABELS = {
  manual: 'Manual entry',
  ao3: 'AO3',
  book_provider: 'Google Books',
} as const;

const PREVIEW_TAG_COUNT = 3;

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

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ReadableDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useAppTheme();

  const { readable, isLoading, isError, error, refetch } = useReadable(id);
  const { update, isPending: isUpdating } = useUpdateReadable();
  const { remove, isPending: isDeleting } = useDeleteReadable();

  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [progressEditorVisible, setProgressEditorVisible] = useState(false);
  const [progressEditorError, setProgressEditorError] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [localStatus, setLocalStatus] = useState<ReadableStatus | null>(null);

  useEffect(() => {
    setLocalStatus(null);
  }, [readable?.status]);

  const displayStatus: ReadableStatus = localStatus ?? readable?.status ?? 'want_to_read';

  useEffect(() => {
    if (readable) {
      navigation.setOptions({ title: readable.title });
    }
  }, [navigation, readable?.title]);

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
          setLocalStatus(null);
          showSnackbar(err.message);
        },
      },
    );
  }

  function handleProgressSave(progressCurrent: number | null, progressTotal: number | null) {
    if (!readable) return;
    setProgressEditorError(null);
    update(
      { id: readable.id, input: { progressCurrent, progressTotal }, current: readable },
      {
        onSuccess: () => {
          setProgressEditorVisible(false);
          setProgressEditorError(null);
        },
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
        <Text variant="bodyMedium" style={[styles.centeredMessage, { color: theme.colors.textSecondary }]}>
          {error?.message ?? 'Failed to load readable.'}
        </Text>
        <Button mode="outlined" onPress={refetch}>Try again</Button>
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

  const isAo3LinkValid =
    readable.kind === 'fanfic' &&
    typeof readable.sourceUrl === 'string' &&
    readable.sourceUrl.startsWith('https://archiveofourown.org/');

  const previewTags = tagsExpanded ? readable.tags : readable.tags.slice(0, PREVIEW_TAG_COUNT);
  const hiddenTagCount = readable.tags.length - PREVIEW_TAG_COUNT;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Cover image (books with coverUrl only) ──────────────────────── */}
        {readable.coverUrl !== null && (
          <View style={styles.coverContainer}>
            <Image
              source={{ uri: readable.coverUrl }}
              style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]}
              resizeMode="contain"
            />
          </View>
        )}

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.textPrimary }]}>
          {readable.title}
        </Text>

        {/* ── Author ─────────────────────────────────────────────────────── */}
        {readable.author !== null && (
          <Text variant="titleMedium" style={[styles.author, { color: theme.colors.textSecondary }]}>
            {readable.author}
          </Text>
        )}

        <Divider style={styles.divider} />

        {/* ── Kind / Source ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            KIND
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {KIND_LABELS[readable.kind]}{'  ·  '}{SOURCE_TYPE_LABELS[readable.sourceType]}
          </Text>
        </View>

        {/* ── ISBN (books with isbn only) ─────────────────────────────────── */}
        {readable.isbn !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                ISBN
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {readable.isbn}
              </Text>
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* ── Status ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            STATUS
          </Text>
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
          <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            PROGRESS
          </Text>
          <View style={styles.progressRow}>
            <Text variant="bodyMedium" style={[styles.progressText, { color: theme.colors.textPrimary }]}>
              {formatProgress(readable.progressCurrent, readable.progressTotal, readable.progressUnit)}
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
          {/* Available chapters — fanfic only, shown when set */}
          {readable.kind === 'fanfic' && readable.availableChapters !== null && (
            <Text variant="bodySmall" style={[styles.availableChapters, { color: theme.colors.textSecondary }]}>
              {readable.availableChapters}{' '}
              {readable.availableChapters === 1 ? 'chapter' : 'chapters'} available
            </Text>
          )}
        </View>

        {/* ── isComplete (AO3 fanfic only) ───────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.isComplete !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
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
              <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
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
              <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                TAGS
              </Text>
              <View style={styles.tagRow}>
                {previewTags.map((tag) => (
                  <Chip key={tag} compact style={styles.tag}>{tag}</Chip>
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
          <Text variant="labelSmall" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            DATE ADDED
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {formatDisplayDate(readable.dateAdded)}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          <Button mode="contained" onPress={handleEdit} accessibilityLabel="Edit readable">
            Edit
          </Button>
          {isAo3LinkValid && (
            <Button mode="outlined" onPress={handleViewOnAo3} accessibilityLabel="View on AO3">
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

      <ProgressEditor
        visible={progressEditorVisible}
        readable={readable}
        isSaving={isUpdating}
        errorMessage={progressEditorError ?? undefined}
        onDismiss={handleProgressEditorDismiss}
        onSave={handleProgressSave}
      />

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Delete readable"
        message={`Remove "${readable.title}" from your library? This cannot be undone.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      <Portal>
        <Snackbar visible={snackbarMessage !== null} onDismiss={hideSnackbar} duration={4000}>
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  centeredMessage: { textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  coverContainer: { alignItems: 'center', marginBottom: 16 },
  cover: { width: 120, height: 160, borderRadius: 6 },
  title: { marginBottom: 4 },
  author: { marginBottom: 4 },
  divider: { marginVertical: 12 },
  section: { gap: 6 },
  sectionLabel: {},
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressText: { flex: 1 },
  availableChapters: { marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {},
  tagToggle: { alignSelf: 'flex-start', marginTop: 2 },
  actionsSection: { gap: 12, marginTop: 8 },
});
