// src/features/readables/ui/ReadableDetailScreen.tsx
// v2 Phase 5 — Detail screen with all v2 fields, notes editor, and refresh button.
//
// Display order (v2 §5.1):
//   cover image (books with coverUrl)
//   title
//   author (+ authorType label when fanfic and authorType !== 'known')
//   kind / source
//   series (when seriesName non-null)
//   status (inline — segmented buttons)
//   progress:
//     books:  progressCurrent / totalUnits pages
//     fanfic: row 1 — availableChapters / totalUnits chapters available
//             row 2 — Reading: chapter progressCurrent
//   isComplete / isAbandoned indicators
//   rating (fanfic only, when non-null)
//   fandom (fanfic only, when non-empty)
//   relationships (fanfic only, when non-empty — first 3, collapse/expand)
//   archiveWarnings (fanfic only, when non-empty — distinct visual treatment)
//   summary
//   notes (all, when non-null — collapsible at 3 lines, edit via NotesEditor modal)
//   tags (collapsed — tappable, navigate to Library with includeTags filter)
//   wordCount (fanfic only, when non-null and > 0)
//   publishedAt (fanfic only, when non-null) — "Published on AO3"
//   ao3UpdatedAt (fanfic only, when non-null) — "Last updated on AO3"
//   dateAdded
//   actions: Edit · View on AO3 + Refresh · Delete

import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Divider,
  Icon,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList, TabParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import type { ReadableStatus } from '../domain/readable';
import {
  READABLE_STATUSES,
  STATUS_LABELS_SHORT,
  KIND_LABELS,
  AO3_RATING_LABELS,
} from '../domain/readable';
import { useReadable } from '../hooks/useReadable';
import { useUpdateReadable } from '../hooks/useUpdateReadable';
import { useDeleteReadable } from '../hooks/useDeleteReadable';
import { useUpdateNotes } from '../hooks/useUpdateNotes';
import { useRefreshReadableMetadata } from '../hooks/useRefreshReadableMetadata';
import { ProgressEditor } from './ProgressEditor';
import { NotesEditor } from './NotesEditor';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'ReadableDetail'>;

type DetailNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<TabParamList>
>;

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_TYPE_LABELS = {
  manual: 'Manual entry',
  ao3: 'AO3',
  book_provider: 'Google Books',
} as const;

const PREVIEW_TAG_COUNT = 3;
const PREVIEW_RELATIONSHIP_COUNT = 3;
const NOTES_COLLAPSE_LINES = 3;

const ARCHIVE_WARNING_ORDER = [
  'Creator Chose Not To Use Archive Warnings',
  'No Archive Warnings Apply',
  'Graphic Depictions Of Violence',
  'Major Character Death',
  'Rape/Non-Con',
  'Underage',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatWordCount(count: number): string {
  return count.toLocaleString() + ' words';
}

function formatSeriesDisplay(
  seriesName: string | null,
  seriesPart: number | null,
  seriesTotal: number | null,
): string | null {
  if (!seriesName) return null;
  if (seriesPart === null) return `Part of ${seriesName}`;
  const total = seriesTotal !== null ? String(seriesTotal) : '?';
  return `Part ${seriesPart} of ${total} in ${seriesName}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReadableDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useAppTheme();
  const detailNav = useNavigation<DetailNavProp>();

  const { readable, isLoading, isError, error, refetch } = useReadable(id);
  const { update, isPending: isUpdating } = useUpdateReadable();
  const { remove, isPending: isDeleting } = useDeleteReadable();
  const { updateNotesAsync, isPending: isSavingNotes } = useUpdateNotes(id);
  const { refreshAsync, isPending: isRefreshing } = useRefreshReadableMetadata();

  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  // ── Modal / UI state ───────────────────────────────────────────────────────
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [progressEditorVisible, setProgressEditorVisible] = useState(false);
  const [progressEditorError, setProgressEditorError] = useState<string | null>(null);
  const [notesEditorVisible, setNotesEditorVisible] = useState(false);
  const [orphanedDialogVisible, setOrphanedDialogVisible] = useState(false);

  // ── Collapse state ─────────────────────────────────────────────────────────
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [relshipsExpanded, setRelshipsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // ── Optimistic status ─────────────────────────────────────────────────────
  const [localStatus, setLocalStatus] = useState<ReadableStatus | null>(null);

  useEffect(() => {
    setLocalStatus(null);
  }, [readable?.status]);

  const displayStatus: ReadableStatus = localStatus ?? readable?.status ?? 'want_to_read';

  // ── Header title ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (readable) {
      navigation.setOptions({ title: readable.title });
    }
  }, [navigation, readable?.title]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  function handleProgressSave(progressCurrent: number | null, totalUnits: number | null) {
    if (!readable) return;
    setProgressEditorError(null);
    update(
      { id: readable.id, input: { progressCurrent, totalUnits }, current: readable },
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

  async function handleNotesSave(notes: string | null) {
    try {
      await updateNotesAsync(notes);
      setNotesEditorVisible(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save notes.';
      showSnackbar(msg);
      // Modal stays open — caller controls visible
    }
  }

  async function handleViewOnAo3() {
    if (!readable?.sourceUrl) return;
    try {
      await Linking.openURL(readable.sourceUrl);
    } catch {
      showSnackbar('Could not open the AO3 link.');
    }
  }

  async function handleRefresh() {
    try {
      const result = await refreshAsync(id);
      if (!result.updated) {
        showSnackbar('No changes — already up to date');
      } else if (result.statusReverted) {
        showSnackbar('New chapters found — reverted to Reading');
      } else {
        showSnackbar('Metadata updated');
      }
    } catch {
      showSnackbar('Could not refresh — check your connection and try again');
    }
  }

  function handleTagPress(tag: string) {
    detailNav.navigate('MainTabs', {
      screen: 'Library',
      params: { initialFilters: { includeTags: [tag] } },
    });
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

  // ── Guards ────────────────────────────────────────────────────────────────

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

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
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

  // ── Derived values ────────────────────────────────────────────────────────

  const isAo3FanficWithUrl =
    readable.kind === 'fanfic' &&
    typeof readable.sourceUrl === 'string' &&
    readable.sourceUrl.startsWith('https://archiveofourown.org/');

  const seriesDisplay = formatSeriesDisplay(
    readable.seriesName,
    readable.seriesPart,
    readable.seriesTotal,
  );

  const previewTags = tagsExpanded ? readable.tags : readable.tags.slice(0, PREVIEW_TAG_COUNT);
  const hiddenTagCount = readable.tags.length - PREVIEW_TAG_COUNT;

  const previewRelationships = relshipsExpanded
    ? readable.relationships
    : readable.relationships.slice(0, PREVIEW_RELATIONSHIP_COUNT);
  const hiddenRelationshipCount = readable.relationships.length - PREVIEW_RELATIONSHIP_COUNT;

  // authorType display
  const isAnonymous = readable.authorType === 'anonymous';
  const isOrphaned = readable.authorType === 'orphaned';
  const displayAuthor = isAnonymous
    ? 'Anonymous'
    : isOrphaned
    ? 'Orphaned work'
    : (readable.author ?? null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Cover image (books with coverUrl only) ─────────────────────── */}
        {readable.coverUrl !== null && (
          <View style={styles.coverContainer}>
            <Image
              source={{ uri: readable.coverUrl }}
              style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]}
              resizeMode="contain"
            />
          </View>
        )}

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.textPrimary }]}
        >
          {readable.title}
        </Text>

        {/* ── Author (with authorType label for fanfic) ─────────────────────── */}
        {displayAuthor !== null && (
          <View style={styles.authorRow}>
            <Text
              variant="titleMedium"
              style={[styles.author, { color: theme.colors.textSecondary }]}
            >
              {displayAuthor}
            </Text>
            {isOrphaned && (
              <TouchableRipple
                onPress={() => setOrphanedDialogVisible(true)}
                style={styles.orphanedIcon}
                accessibilityLabel="What does Orphaned work mean?"
                accessibilityRole="button"
              >
                <Icon source="information-outline" size={18} color={theme.colors.textSecondary} />
              </TouchableRipple>
            )}
          </View>
        )}

        <Divider style={styles.divider} />

        {/* ── Kind / Source ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            KIND
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
            {KIND_LABELS[readable.kind]}{'  ·  '}{SOURCE_TYPE_LABELS[readable.sourceType]}
          </Text>
        </View>

        {/* ── ISBN (books with isbn only) ──────────────────────────────────── */}
        {readable.isbn !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                ISBN
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {readable.isbn}
              </Text>
            </View>
          </>
        )}

        {/* ── Series ───────────────────────────────────────────────────────── */}
        {seriesDisplay !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                SERIES
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {seriesDisplay}
              </Text>
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* ── Status ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            STATUS
          </Text>
          <SegmentedButtons
            value={displayStatus}
            onValueChange={(v) => handleStatusChange(v as ReadableStatus)}
            buttons={READABLE_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS_SHORT[s],
              disabled: isUpdating,
            }))}
          />
        </View>

        <Divider style={styles.divider} />

        {/* ── Progress ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelSmall"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            PROGRESS
          </Text>

          {readable.kind === 'fanfic' ? (
            // Fanfic: two rows — author progress + user progress
            <View style={styles.fanficProgressBlock}>
              {/* Row 1: availableChapters / totalUnits chapters available */}
              {(readable.availableChapters !== null || readable.totalUnits !== null) && (
                <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                  {readable.availableChapters !== null
                    ? String(readable.availableChapters)
                    : '--'}{' / '}
                  {readable.totalUnits !== null ? String(readable.totalUnits) : '?'}{' chapters available'}
                </Text>
              )}
              {/* Row 2: Reading: chapter X (user position) */}
              {readable.progressCurrent !== null && (
                <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                  {'Reading: chapter '}{readable.progressCurrent}
                </Text>
              )}
              {readable.availableChapters === null &&
                readable.totalUnits === null &&
                readable.progressCurrent === null && (
                  <Text variant="bodyMedium" style={{ color: theme.colors.textSecondary }}>
                    No progress recorded
                  </Text>
                )}
            </View>
          ) : (
            // Books: single row — progressCurrent / totalUnits pages
            <View style={styles.progressRow}>
              <Text
                variant="bodyMedium"
                style={[styles.progressText, { color: theme.colors.textPrimary }]}
              >
                {readable.progressCurrent !== null || readable.totalUnits !== null
                  ? `${readable.progressCurrent !== null ? readable.progressCurrent : '--'} / ${readable.totalUnits !== null ? readable.totalUnits : '?'} pages`
                  : 'No progress recorded'}
              </Text>
            </View>
          )}

          <Button
            compact
            mode="outlined"
            onPress={() => setProgressEditorVisible(true)}
            disabled={isUpdating}
            accessibilityLabel="Edit progress"
            style={styles.progressEditButton}
          >
            Edit
          </Button>
        </View>

        {/* ── isComplete / isAbandoned indicators ───────────────────────────── */}
        {(readable.kind === 'fanfic' && readable.isComplete !== null) ||
          (readable.kind === 'fanfic' && readable.isAbandoned) ? (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                STATUS FLAGS
              </Text>
              <View style={styles.chipRow}>
                {readable.kind === 'fanfic' && readable.isComplete !== null && (
                  <Chip compact>
                    {readable.isComplete ? 'Complete' : 'WIP'}
                  </Chip>
                )}
                {readable.kind === 'fanfic' && readable.isAbandoned && (
                  <Chip
                    compact
                    style={{ backgroundColor: theme.colors.errorContainer }}
                    textStyle={{ color: theme.colors.error }}
                  >
                    Abandoned
                  </Chip>
                )}
              </View>
            </View>
          </>
        ) : null}

        {/* ── Rating (fanfic only, when non-null) ───────────────────────────── */}
        {readable.kind === 'fanfic' && readable.rating !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                RATING
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {AO3_RATING_LABELS[readable.rating]}
              </Text>
            </View>
          </>
        )}

        {/* ── Fandom (fanfic only, when non-empty) ──────────────────────────── */}
        {readable.kind === 'fanfic' && readable.fandom.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                FANDOM
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {readable.fandom.join(', ')}
              </Text>
            </View>
          </>
        )}

        {/* ── Relationships (fanfic only, first 3 + expand) ─────────────────── */}
        {readable.kind === 'fanfic' && readable.relationships.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                RELATIONSHIPS
              </Text>
              {previewRelationships.map((rel) => (
                <Text
                  key={rel}
                  variant="bodyMedium"
                  style={{ color: theme.colors.textPrimary }}
                >
                  {rel}
                </Text>
              ))}
              {hiddenRelationshipCount > 0 && (
                <Button
                  compact
                  mode="text"
                  onPress={() => setRelshipsExpanded((prev) => !prev)}
                  style={styles.expandButton}
                  accessibilityLabel={
                    relshipsExpanded ? 'Show fewer relationships' : 'Show all relationships'
                  }
                >
                  {relshipsExpanded ? 'Show less' : `+${hiddenRelationshipCount} more`}
                </Button>
              )}
            </View>
          </>
        )}

        {/* ── Archive Warnings (fanfic only — distinct visual treatment) ───── */}
        {readable.kind === 'fanfic' && readable.archiveWarnings.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <View style={styles.warningHeader}>
                <Icon source="alert" size={14} color={theme.colors.error} />
                <Text
                  variant="labelSmall"
                  style={[styles.sectionLabel, { color: theme.colors.error }]}
                >
                  {'  ARCHIVE WARNINGS'}
                </Text>
              </View>
              <View style={styles.chipRow}>
                {readable.archiveWarnings.map((w) => (
                  <Chip
                    key={w}
                    compact
                    icon="alert-circle-outline"
                    style={{ backgroundColor: theme.colors.errorContainer }}
                    textStyle={{ color: theme.colors.error }}
                  >
                    {w}
                  </Chip>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Summary ───────────────────────────────────────────────────────── */}
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

        {/* ── Notes (all kinds — collapsible, editable) ─────────────────────── */}
        <>
          <Divider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.notesTitleRow}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                NOTES
              </Text>
              <Button
                compact
                mode="text"
                onPress={() => setNotesEditorVisible(true)}
                accessibilityLabel={readable.notes ? 'Edit notes' : 'Add notes'}
              >
                {readable.notes ? 'Edit' : 'Add'}
              </Button>
            </View>
            {readable.notes !== null ? (
              <>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.textPrimary }}
                  numberOfLines={notesExpanded ? undefined : NOTES_COLLAPSE_LINES}
                >
                  {readable.notes}
                </Text>
                {readable.notes.split('\n').length > NOTES_COLLAPSE_LINES ||
                readable.notes.length > 200 ? (
                  <Button
                    compact
                    mode="text"
                    onPress={() => setNotesExpanded((prev) => !prev)}
                    style={styles.expandButton}
                    accessibilityLabel={notesExpanded ? 'Collapse notes' : 'Expand notes'}
                  >
                    {notesExpanded ? 'Show less' : 'Show more'}
                  </Button>
                ) : null}
                {readable.notesUpdatedAt !== null && (
                  <Text
                    variant="bodySmall"
                    style={[styles.notesTimestamp, { color: theme.colors.textSecondary }]}
                  >
                    {`Note last updated ${formatDisplayDate(readable.notesUpdatedAt)}`}
                  </Text>
                )}
              </>
            ) : (
              <Text variant="bodySmall" style={{ color: theme.colors.textSecondary }}>
                Private — not imported from AO3
              </Text>
            )}
          </View>
        </>

        {/* ── Tags (tappable — navigate to Library with includeTags filter) ── */}
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
              <View style={styles.chipRow}>
                {previewTags.map((tag) => (
                  <Chip
                    key={tag}
                    compact
                    onPress={() => handleTagPress(tag)}
                    accessibilityLabel={`Filter by tag: ${tag}`}
                    accessibilityRole="button"
                    style={styles.tag}
                  >
                    {tag}
                  </Chip>
                ))}
              </View>
              {hiddenTagCount > 0 && (
                <Button
                  compact
                  mode="text"
                  onPress={() => setTagsExpanded((prev) => !prev)}
                  style={styles.expandButton}
                  accessibilityLabel={tagsExpanded ? 'Show fewer tags' : 'Show all tags'}
                >
                  {tagsExpanded ? 'Show less' : `+${hiddenTagCount} more`}
                </Button>
              )}
            </View>
          </>
        )}

        {/* ── Word count (fanfic only, when non-null and > 0) ───────────────── */}
        {readable.kind === 'fanfic' &&
          readable.wordCount !== null &&
          readable.wordCount > 0 && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.section}>
                <Text
                  variant="labelSmall"
                  style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
                >
                  WORD COUNT
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                  {formatWordCount(readable.wordCount)}
                </Text>
              </View>
            </>
          )}

        {/* ── Published on AO3 (fanfic only, when non-null) ────────────────── */}
        {readable.kind === 'fanfic' && readable.publishedAt !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                PUBLISHED ON AO3
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {formatDisplayDate(readable.publishedAt)}
              </Text>
            </View>
          </>
        )}

        {/* ── Last updated on AO3 (fanfic only, when non-null) ──────────────── */}
        {readable.kind === 'fanfic' && readable.ao3UpdatedAt !== null && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text
                variant="labelSmall"
                style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
              >
                LAST UPDATED ON AO3
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
                {formatDisplayDate(readable.ao3UpdatedAt)}
              </Text>
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* ── Date Added ────────────────────────────────────────────────────── */}
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

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleEdit}
            accessibilityLabel="Edit readable"
          >
            Edit
          </Button>

          {isAo3FanficWithUrl && (
            <>
              <Button
                mode="outlined"
                onPress={() => void handleViewOnAo3()}
                accessibilityLabel="View on AO3"
              >
                View on AO3
              </Button>
              <Button
                mode="outlined"
                onPress={() => void handleRefresh()}
                loading={isRefreshing}
                disabled={isRefreshing}
                accessibilityLabel="Refresh AO3 metadata"
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
            </>
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

      {/* ── ProgressEditor modal ────────────────────────────────────────────── */}
      <ProgressEditor
        visible={progressEditorVisible}
        readable={readable}
        isSaving={isUpdating}
        errorMessage={progressEditorError ?? undefined}
        onDismiss={handleProgressEditorDismiss}
        onSave={handleProgressSave}
      />

      {/* ── NotesEditor modal ───────────────────────────────────────────────── */}
      <NotesEditor
        visible={notesEditorVisible}
        initialNotes={readable.notes}
        isSaving={isSavingNotes}
        onDismiss={() => setNotesEditorVisible(false)}
        onSave={handleNotesSave}
      />

      {/* ── Delete confirm dialog ───────────────────────────────────────────── */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Delete readable"
        message={`Remove "${readable.title}" from your library? This cannot be undone.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      {/* ── Orphaned work explanation dialog ───────────────────────────────── */}
      <Portal>
        <Dialog
          visible={orphanedDialogVisible}
          onDismiss={() => setOrphanedDialogVisible(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title style={{ color: theme.colors.textPrimary }}>
            Orphaned work
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
              The author transferred this work to AO3&apos;s orphan_account, permanently severing
              their account association. The work remains available on AO3, but no named author
              is associated with it. This is distinct from an anonymous posting — orphaning is
              a deliberate, permanent action.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOrphanedDialogVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Snackbar ────────────────────────────────────────────────────────── */}
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
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  centeredMessage: { textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  coverContainer: { alignItems: 'center', marginBottom: 16 },
  cover: { width: 120, height: 160, borderRadius: 6 },
  title: { marginBottom: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  author: { flexShrink: 1 },
  orphanedIcon: { marginLeft: 4, padding: 2, borderRadius: 10 },
  divider: { marginVertical: 12 },
  section: { gap: 6 },
  sectionLabel: {},
  // Fanfic progress block — stacked rows
  fanficProgressBlock: { gap: 4 },
  // Book progress row
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressText: { flex: 1 },
  progressEditButton: { alignSelf: 'flex-start', marginTop: 4 },
  // Status flags + chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // Warning header (icon + label)
  warningHeader: { flexDirection: 'row', alignItems: 'center' },
  // Notes
  notesTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notesTimestamp: { marginTop: 4 },
  // Tags
  tag: {},
  // Expand/collapse buttons
  expandButton: { alignSelf: 'flex-start', marginTop: 2 },
  // Actions
  actionsSection: { gap: 12, marginTop: 8 },
});
