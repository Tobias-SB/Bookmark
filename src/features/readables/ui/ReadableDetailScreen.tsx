// src/features/readables/ui/ReadableDetailScreen.tsx
// UI Phase 3 — Full card-based redesign.
//
// Layout:
//   [hero — fixed, not scrollable]
//     LinearGradient (backgroundBorder → backgroundPage)
//       back bar · kind badge + source line · title · author · custom status pills
//   [ScrollView]
//     Progress card (floating)
//     Metadata section cards (each section is its own card)
//     Action buttons row

import React, { useEffect, useState } from 'react';
import {
  type DimensionValue,
  Image,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Snackbar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList, TabParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { AppTheme } from '../../../app/theme/tokens';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import type { ReadableStatus } from '../domain/readable';
import {
  READABLE_STATUSES,
  STATUS_LABELS_FULL,
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
import { CoverPickerModal } from './CoverPickerModal';

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

function getStatusTokens(
  status: ReadableStatus,
  theme: AppTheme,
): { bg: string; text: string; border: string } {
  switch (status) {
    case 'reading':
      return {
        bg: theme.colors.statusReadingBg,
        text: theme.colors.statusReadingText,
        border: theme.colors.statusReadingBorder,
      };
    case 'completed':
      return {
        bg: theme.colors.statusCompletedBg,
        text: theme.colors.statusCompletedText,
        border: theme.colors.statusCompletedBorder,
      };
    case 'dnf':
      return {
        bg: theme.colors.statusDnfBg,
        text: theme.colors.statusDnfText,
        border: theme.colors.statusDnfBorder,
      };
    case 'want_to_read':
    default:
      return {
        bg: theme.colors.statusWantBg,
        text: theme.colors.statusWantText,
        border: theme.colors.statusWantBorder,
      };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 10, height: 18, justifyContent: 'center' }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }, { translateX: 3 }],
        }}
      />
    </View>
  );
}

interface SectionCardProps {
  label: string;
  children: React.ReactNode;
  theme: AppTheme;
  headerRight?: React.ReactNode;
}

function SectionCard({ label, children, theme, headerRight }: SectionCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.backgroundCard,
          ...theme.shadows.card,
        },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardLabel, { color: theme.colors.textMeta }]}>{label}</Text>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReadableDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const detailNav = useNavigation<DetailNavProp>();

  const { readable, isLoading, isError, error, refetch } = useReadable(id);
  const { update, isPending: isUpdating } = useUpdateReadable();
  const { remove, isPending: isDeleting } = useDeleteReadable();
  const { updateNotesAsync, isPending: isSavingNotes } = useUpdateNotes(id);
  const { refreshAsync, isPending: isRefreshing } = useRefreshReadableMetadata();

  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  // ── Android status bar translucency ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
      return () => {
        RNStatusBar.setTranslucent(false);
      };
    }
  }, []);

  // ── Modal / UI state ───────────────────────────────────────────────────────
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [progressEditorVisible, setProgressEditorVisible] = useState(false);
  const [progressEditorError, setProgressEditorError] = useState<string | null>(null);
  const [notesEditorVisible, setNotesEditorVisible] = useState(false);
  const [orphanedDialogVisible, setOrphanedDialogVisible] = useState(false);
  const [coverPickerVisible, setCoverPickerVisible] = useState(false);

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

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  function handleProgressSave(progressCurrent: number | null) {
    if (!readable) return;
    setProgressEditorError(null);
    update(
      { id: readable.id, input: { progressCurrent }, current: readable },
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

  // ── Mini back bar for loading/error states ────────────────────────────────

  function MiniBackBar() {
    return (
      <View style={[styles.miniBackBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.heroBackButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeftIcon color={theme.colors.textMeta} />
          <Text style={[styles.heroBackText, { color: theme.colors.textMeta }]}>Library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundPage }}>
        <StatusBar style="dark" />
        <MiniBackBar />
        <View style={styles.centered}>
          <Text style={[styles.centeredMessage, { color: theme.colors.textSecondary }]}>
            {error?.message ?? 'Failed to load readable.'}
          </Text>
          <Button mode="outlined" onPress={refetch}>Try again</Button>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundPage }}>
        <StatusBar style="dark" />
        <MiniBackBar />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  if (!readable) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.backgroundPage }}>
        <StatusBar style="dark" />
        <MiniBackBar />
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.textSecondary }}>Readable not found.</Text>
        </View>
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

  const isAnonymous = readable.authorType === 'anonymous';
  const isOrphaned = readable.authorType === 'orphaned';
  const displayAuthor = isAnonymous
    ? 'Anonymous'
    : isOrphaned
    ? 'Orphaned work'
    : (readable.author ?? null);

  const kindAccentColor =
    readable.kind === 'book' ? theme.colors.kindBook : theme.colors.kindFanfic;
  const kindSubtleColor =
    readable.kind === 'book' ? theme.colors.kindBookSubtle : theme.colors.kindFanficSubtle;
  const kindBorderColor =
    readable.kind === 'book' ? theme.colors.kindBookBorder : theme.colors.kindFanficBorder;

  const sourceLabel = SOURCE_TYPE_LABELS[readable.sourceType];

  // Progress bar percentage.
  // For fanfic, prefer availableChapters (supports ? totalUnits); fall back to totalUnits.
  // For book, totalUnits is always the page count denominator.
  const progressDenominator =
    readable.kind === 'fanfic'
      ? (readable.availableChapters ?? readable.totalUnits)
      : readable.totalUnits;
  const progressPct =
    readable.progressCurrent !== null && progressDenominator !== null && progressDenominator > 0
      ? Math.min(100, Math.round((readable.progressCurrent / progressDenominator) * 100))
      : null;

  // Progress subtext
  let progressSubtext: string;
  if (readable.kind === 'fanfic') {
    const chapterPos =
      readable.progressCurrent !== null ? `Reading ch. ${readable.progressCurrent}` : null;
    const chapterAvail =
      readable.availableChapters !== null || readable.totalUnits !== null
        ? `${readable.availableChapters ?? '--'} of ${readable.totalUnits ?? '?'} chapters available`
        : null;
    if (chapterPos && chapterAvail) {
      progressSubtext = `${chapterPos} · ${chapterAvail}`;
    } else if (chapterPos) {
      progressSubtext = chapterPos;
    } else if (chapterAvail) {
      progressSubtext = chapterAvail;
    } else {
      progressSubtext = 'No progress recorded';
    }
  } else {
    progressSubtext =
      readable.progressCurrent !== null || readable.totalUnits !== null
        ? `${readable.progressCurrent ?? '--'} / ${readable.totalUnits ?? '?'} pages`
        : 'No progress recorded';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.backgroundPage }}>
      <StatusBar style="dark" />

      {/* ── Hero gradient — fixed, not scrollable ──────────────────────────── */}
      <LinearGradient
        colors={[theme.colors.backgroundInput, theme.colors.backgroundPage]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top }]}
      >
        {/* Back row + centered title */}
        <View style={styles.heroTitleRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.heroBackButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeftIcon color={theme.colors.textMeta} />
            <Text style={[styles.heroBackText, { color: theme.colors.textMeta }]}>Library</Text>
          </TouchableOpacity>
          {/* Pointer-events none so this overlay never absorbs touches meant for the back button */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.heroTitleContainer]}>
            <Text
              style={[styles.heroTitle, { color: theme.colors.textPrimary }]}
              numberOfLines={2}
            >
              {readable.title}
            </Text>
          </View>
        </View>

        {/* Meta row: author · kind · source */}
        <View style={styles.heroMetaRow}>
          {displayAuthor !== null && (
            <>
              <Text
                style={[
                  styles.heroMetaAuthor,
                  {
                    color:
                      isAnonymous || isOrphaned
                        ? theme.colors.textMeta
                        : theme.colors.textBody,
                  },
                ]}
                numberOfLines={1}
              >
                {displayAuthor}
              </Text>
              {isOrphaned && (
                <TouchableOpacity
                  onPress={() => setOrphanedDialogVisible(true)}
                  style={styles.orphanedIcon}
                  accessibilityLabel="What does Orphaned work mean?"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.orphanedCircle, { color: theme.colors.textMeta }]}>ⓘ</Text>
                </TouchableOpacity>
              )}
              <Text style={{ color: theme.colors.textMeta, fontSize: 12 }}> · </Text>
            </>
          )}
          <View
            style={[
              styles.kindBadge,
              { backgroundColor: kindSubtleColor, borderColor: kindBorderColor },
            ]}
          >
            <Text style={[styles.kindBadgeText, { color: kindAccentColor }]}>
              {KIND_LABELS[readable.kind]}
            </Text>
          </View>
          <Text style={{ color: theme.colors.textMeta, fontSize: 12 }}> · </Text>
          <Text style={[styles.heroMetaSource, { color: theme.colors.textMeta }]} numberOfLines={1}>
            {sourceLabel}
          </Text>
        </View>

        {/* Custom status pill buttons */}
        <View style={styles.heroStatusRow}>
          {READABLE_STATUSES.map((s) => {
            const isActive = s === displayStatus;
            const tok = getStatusTokens(s, theme);
            return (
              <TouchableOpacity
                key={s}
                onPress={() => handleStatusChange(s)}
                disabled={isUpdating}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isActive ? tok.bg : theme.colors.backgroundInput,
                    borderColor: isActive ? tok.border : theme.colors.backgroundBorder,
                    opacity: isUpdating ? 0.6 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={STATUS_LABELS_FULL[s]}
                accessibilityHint="Changes your reading status for this work"
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: isActive ? tok.text : theme.colors.textBody,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {STATUS_LABELS_FULL[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* ── Cover image — always shown; tappable to open CoverPickerModal ── */}
        <View style={styles.coverContainer}>
          <TouchableOpacity
            onPress={() => setCoverPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={readable.coverUrl ? 'Change cover image' : 'Set cover image'}
            accessibilityHint="Opens options to choose from device, paste a URL, or remove"
          >
            {readable.coverUrl !== null ? (
              <Image
                source={{ uri: readable.coverUrl }}
                style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]}
                resizeMode="contain"
              />
            ) : (
              <View
                style={[
                  styles.cover,
                  styles.coverPlaceholder,
                  { backgroundColor: kindSubtleColor },
                ]}
              >
                <Text style={styles.coverPlaceholderIcon}>🖼</Text>
                <Text style={[styles.coverPlaceholderLabel, { color: theme.colors.textMeta }]}>
                  Set cover
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Progress card ──────────────────────────────────────────────────── */}
        <View
          style={[
            styles.progressCard,
            {
              backgroundColor: theme.colors.backgroundCard,
              ...theme.shadows.card,
            },
          ]}
        >
          <View style={styles.progressCardHeader}>
            <Text style={[styles.progressCardTitle, { color: theme.colors.textPrimary }]}>
              Progress
            </Text>
            {progressPct !== null && (
              <Text style={[styles.progressCardPct, { color: theme.colors.textBody }]}>
                {progressPct}%
              </Text>
            )}
          </View>

          {/* Progress bar */}
          <View
            style={[styles.progressBarTrack, { backgroundColor: kindSubtleColor }]}
          >
            {progressPct !== null && (
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: kindAccentColor, width: `${progressPct}%` as DimensionValue },
                ]}
              />
            )}
          </View>

          <Text style={[styles.progressSubtext, { color: theme.colors.textMeta }]}>
            {progressSubtext}
          </Text>

          <TouchableOpacity
            onPress={() => setProgressEditorVisible(true)}
            disabled={isUpdating}
            style={styles.editProgressButton}
            accessibilityLabel="Edit progress"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.editProgressText,
                {
                  color: kindAccentColor,
                  textDecorationColor: kindBorderColor,
                },
              ]}
            >
              Edit progress
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── STATUS FLAGS ──────────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' &&
          (readable.isComplete !== null || readable.isAbandoned) && (
            <SectionCard label="STATUS FLAGS" theme={theme}>
              <View style={styles.chipRow}>
                {readable.isComplete !== null && (
                  <View
                    style={[
                      styles.chip,
                      readable.isComplete
                        ? {
                            backgroundColor: theme.colors.statusCompletedBg,
                            borderColor: theme.colors.statusCompletedBorder,
                          }
                        : {
                            backgroundColor: theme.colors.backgroundInput,
                            borderColor: theme.colors.backgroundBorder,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: readable.isComplete
                            ? theme.colors.statusCompletedText
                            : theme.colors.textBody,
                        },
                      ]}
                    >
                      {readable.isComplete ? 'Complete' : 'WIP'}
                    </Text>
                  </View>
                )}
                {readable.isAbandoned && (
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: theme.colors.dangerSubtle,
                        borderColor: theme.colors.dangerBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: theme.colors.danger }]}>
                      Abandoned
                    </Text>
                  </View>
                )}
              </View>
            </SectionCard>
          )}

        {/* ── ARCHIVE WARNINGS ──────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.archiveWarnings.length > 0 && (
          <SectionCard label="ARCHIVE WARNINGS" theme={theme}>
            <View style={styles.chipRow}>
              {readable.archiveWarnings.map((w) => {
                const isNoWarning = w === 'No Archive Warnings Apply';
                return (
                  <View
                    key={w}
                    style={[
                      styles.chip,
                      isNoWarning
                        ? {
                            backgroundColor: theme.colors.backgroundInput,
                            borderColor: theme.colors.backgroundBorder,
                          }
                        : {
                            backgroundColor: theme.colors.dangerSubtle,
                            borderColor: theme.colors.dangerBorder,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isNoWarning
                          ? { color: theme.colors.textBody }
                          : { color: theme.colors.danger, fontWeight: '500' },
                      ]}
                    >
                      {isNoWarning ? w : `⚠ ${w}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </SectionCard>
        )}

        {/* ── RATING ────────────────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.rating !== null && (
          <SectionCard label="RATING" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {AO3_RATING_LABELS[readable.rating]}
            </Text>
          </SectionCard>
        )}

        {/* ── FANDOM ────────────────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.fandom.length > 0 && (
          <SectionCard label="FANDOM" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {readable.fandom.join(', ')}
            </Text>
          </SectionCard>
        )}

        {/* ── RELATIONSHIPS ─────────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.relationships.length > 0 && (
          <SectionCard label="RELATIONSHIPS" theme={theme}>
            <View style={{ gap: 4 }}>
              {previewRelationships.map((rel) => (
                <Text key={rel} style={[styles.bodyText, { color: theme.colors.textBody }]}>
                  {rel}
                </Text>
              ))}
            </View>
            {hiddenRelationshipCount > 0 && (
              <TouchableOpacity
                onPress={() => setRelshipsExpanded((p) => !p)}
                style={styles.expandButton}
                accessibilityLabel={
                  relshipsExpanded ? 'Show fewer relationships' : 'Show all relationships'
                }
                accessibilityRole="button"
              >
                <Text style={[styles.expandText, { color: kindAccentColor }]}>
                  {relshipsExpanded ? 'Show less' : `+${hiddenRelationshipCount} more`}
                </Text>
              </TouchableOpacity>
            )}
          </SectionCard>
        )}

        {/* ── SERIES ────────────────────────────────────────────────────────── */}
        {seriesDisplay !== null && (
          <SectionCard label="SERIES" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {seriesDisplay}
            </Text>
          </SectionCard>
        )}

        {/* ── SUMMARY ───────────────────────────────────────────────────────── */}
        {readable.summary !== null && (
          <SectionCard label="SUMMARY" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {readable.summary}
            </Text>
          </SectionCard>
        )}

        {/* ── NOTES — always rendered ────────────────────────────────────────── */}
        <SectionCard
          label="NOTES"
          theme={theme}
          headerRight={
            <TouchableOpacity
              onPress={() => setNotesEditorVisible(true)}
              style={styles.notesEditButton}
              accessibilityLabel={readable.notes ? 'Edit notes' : 'Add notes'}
              accessibilityRole="button"
            >
              <Text style={[styles.notesEditText, { color: kindAccentColor }]}>
                {readable.notes ? 'Edit' : 'Add'}
              </Text>
            </TouchableOpacity>
          }
        >
          {readable.notes !== null ? (
            <>
              <Text
                style={[styles.bodyText, { color: theme.colors.textBody }]}
                numberOfLines={notesExpanded ? undefined : NOTES_COLLAPSE_LINES}
              >
                {readable.notes}
              </Text>
              {(readable.notes.split('\n').length > NOTES_COLLAPSE_LINES ||
                readable.notes.length > 200) && (
                <TouchableOpacity
                  onPress={() => setNotesExpanded((p) => !p)}
                  style={styles.expandButton}
                  accessibilityLabel={notesExpanded ? 'Collapse notes' : 'Expand notes'}
                  accessibilityRole="button"
                >
                  <Text style={[styles.expandText, { color: kindAccentColor }]}>
                    {notesExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              )}
              {readable.notesUpdatedAt !== null && (
                <Text style={[styles.notesTimestamp, { color: theme.colors.textMeta }]}>
                  {`Note last updated ${formatDisplayDate(readable.notesUpdatedAt)}`}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.bodyText, { color: theme.colors.textMeta, fontSize: 12 }]}>
              Private — not imported from AO3
            </Text>
          )}
        </SectionCard>

        {/* ── TAGS ──────────────────────────────────────────────────────────── */}
        {readable.tags.length > 0 && (
          <SectionCard label="TAGS" theme={theme}>
            <View style={styles.chipRow}>
              {previewTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleTagPress(tag)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: theme.colors.backgroundInput,
                      borderColor: theme.colors.backgroundBorder,
                    },
                  ]}
                  accessibilityLabel={`Filter by tag: ${tag}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, { color: theme.colors.textBody }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {hiddenTagCount > 0 && (
              <TouchableOpacity
                onPress={() => setTagsExpanded((p) => !p)}
                style={styles.expandButton}
                accessibilityLabel={tagsExpanded ? 'Show fewer tags' : 'Show all tags'}
                accessibilityRole="button"
              >
                <Text style={[styles.expandText, { color: kindAccentColor, fontWeight: '500' }]}>
                  {tagsExpanded ? 'Show less' : `+${hiddenTagCount} more`}
                </Text>
              </TouchableOpacity>
            )}
          </SectionCard>
        )}

        {/* ── WORD COUNT ────────────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' &&
          readable.wordCount !== null &&
          readable.wordCount > 0 && (
            <SectionCard label="WORD COUNT" theme={theme}>
              <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
                {formatWordCount(readable.wordCount)}
              </Text>
            </SectionCard>
          )}

        {/* ── PUBLISHED ON AO3 ──────────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.publishedAt !== null && (
          <SectionCard label="PUBLISHED ON AO3" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {formatDisplayDate(readable.publishedAt)}
            </Text>
          </SectionCard>
        )}

        {/* ── LAST UPDATED ON AO3 ───────────────────────────────────────────── */}
        {readable.kind === 'fanfic' && readable.ao3UpdatedAt !== null && (
          <SectionCard label="LAST UPDATED ON AO3" theme={theme}>
            <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
              {formatDisplayDate(readable.ao3UpdatedAt)}
            </Text>
          </SectionCard>
        )}

        {/* ── DATE ADDED — always rendered ──────────────────────────────────── */}
        <SectionCard label="DATE ADDED" theme={theme}>
          <Text style={[styles.bodyText, { color: theme.colors.textBody }]}>
            {formatDisplayDate(readable.dateAdded)}
          </Text>
        </SectionCard>

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          {/* Edit */}
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditReadable', { id })}
            style={[
              styles.actionButton,
              {
                backgroundColor: kindAccentColor,
                borderColor: kindAccentColor,
                ...theme.shadows.button,
              },
            ]}
            accessibilityLabel="Edit readable"
            accessibilityRole="button"
          >
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Edit</Text>
          </TouchableOpacity>

          {/* View on AO3 */}
          {isAo3FanficWithUrl && (
            <TouchableOpacity
              onPress={() => void handleViewOnAo3()}
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.kindFanficSubtle,
                  borderColor: theme.colors.kindFanficBorder,
                },
              ]}
              accessibilityLabel="View on AO3"
              accessibilityRole="button"
            >
              <Text style={[styles.actionButtonText, { color: theme.colors.kindFanfic }]}>
                View on AO3
              </Text>
            </TouchableOpacity>
          )}

          {/* Refresh */}
          {isAo3FanficWithUrl && (
            <TouchableOpacity
              onPress={() => void handleRefresh()}
              disabled={isRefreshing}
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.backgroundCard,
                  borderColor: theme.colors.backgroundBorder,
                  ...theme.shadows.small,
                  opacity: isRefreshing ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="Refresh AO3 metadata"
              accessibilityRole="button"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : null}
              <Text style={[styles.actionButtonText, { color: theme.colors.textPrimary }]}>
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity
            onPress={() => setConfirmDeleteVisible(true)}
            disabled={isDeleting}
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.colors.dangerSubtle,
                borderColor: theme.colors.dangerBorder,
                opacity: isDeleting ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Delete readable"
            accessibilityRole="button"
          >
            <Text style={[styles.actionButtonText, { color: theme.colors.danger }]}>Delete</Text>
          </TouchableOpacity>
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
          <Dialog.Title style={{ color: theme.colors.textPrimary }}>Orphaned work</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.textPrimary }}>
              The author transferred this work to AO3&apos;s orphan_account, permanently severing
              their account association. The work remains available on AO3, but no named author
              is associated with it. This is distinct from an anonymous posting — orphaning is a
              deliberate, permanent action.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOrphanedDialogVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Cover picker modal ──────────────────────────────────────────────── */}
      <CoverPickerModal
        visible={coverPickerVisible}
        onDismiss={() => setCoverPickerVisible(false)}
        readableId={readable.id}
        hasCover={readable.coverUrl !== null}
        onError={showSnackbar}
      />

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
  // Loading / error states
  miniBackBar: { paddingHorizontal: 16, paddingBottom: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  centeredMessage: { textAlign: 'center' },

  // Hero gradient band
  hero: { paddingHorizontal: 18, paddingBottom: 20 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  heroBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 12,
    minHeight: 44,
  },
  heroBackText: { fontSize: 15, fontWeight: '500' },

  // Kind badge (used in meta row)
  kindBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 1,
  },
  kindBadgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },

  // Title — absolutely centered in heroTitleRow, paddingHorizontal keeps it clear of back button.
  // heroTitleContainer fills the row (via absoluteFillObject) and is pointerEvents=none so it
  // never intercepts touches intended for the back button beneath it.
  heroTitleContainer: { justifyContent: 'center' },
  heroTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 26,
    paddingHorizontal: 80,
  },

  // Meta row: author · kind · source
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  heroMetaAuthor: { fontSize: 13, flexShrink: 1 },
  heroMetaSource: { fontSize: 12, flexShrink: 1 },
  orphanedIcon: { marginLeft: 4 },
  orphanedCircle: { fontSize: 16 },

  // Custom status pill buttons
  heroStatusRow: { flexDirection: 'row', gap: 6 },
  statusPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11.5 },

  // ScrollView
  scrollContent: { paddingTop: 12 },

  // Cover image
  coverContainer: { alignItems: 'center', marginBottom: 12, marginHorizontal: 14 },
  cover: { width: 120, height: 160, borderRadius: 6 },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverPlaceholderIcon: { fontSize: 28, opacity: 0.5 },
  coverPlaceholderLabel: { fontSize: 12, fontWeight: '500' },

  // Progress card
  progressCard: {
    borderRadius: 18,
    marginHorizontal: 12,
    marginBottom: 9,
    padding: 15,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressCardTitle: { fontSize: 13, fontWeight: '600' },
  progressCardPct: { fontSize: 12 },
  progressBarTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: 5, borderRadius: 3 },
  progressSubtext: { fontSize: 12, marginBottom: 2 },
  editProgressButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  editProgressText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Section cards
  card: {
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 9,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Body text in cards
  bodyText: { fontSize: 13, lineHeight: 20 },

  // Chip rows
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },

  // Notes section
  notesEditButton: { minHeight: 44, justifyContent: 'center' },
  notesEditText: { fontSize: 12, fontWeight: '600' },
  notesTimestamp: { marginTop: 6, fontSize: 11 },

  // Expand/collapse
  expandButton: { marginTop: 6, alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  expandText: { fontSize: 12 },

  // Action buttons row
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 24,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    minHeight: 44,
    borderWidth: 1,
  },
  actionButtonText: { fontSize: 13, fontWeight: '500' },
});
