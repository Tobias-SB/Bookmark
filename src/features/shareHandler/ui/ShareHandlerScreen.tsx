// src/features/shareHandler/ui/ShareHandlerScreen.tsx
// Feature 6 — Share Extension.
// Transparent-modal bottom sheet shown when the user shares an AO3 URL from
// another app. Three states:
//
//   loading   — metadata fetch in progress. Spinner + "Save as Want to Read"
//               button immediately active so the user is never blocked.
//   new       — metadata arrived, work not in library. Title, author, chapter
//               summary, status chips, Save button.
//   duplicate — work already in library (sourceId match). Shows existing entry
//               with "View in Bookmark" and "Dismiss" actions.
//
// The backdrop (Pressable behind the sheet) dismisses on tap.
// Metadata fetch and duplicate check run concurrently on mount.

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { MetadataResult } from '../../metadata/services/types';
import { useImportMetadata } from '../../metadata';
import type { Readable, ReadableStatus } from '../../readables/domain/readable';
import { useFindAo3Duplicate } from '../../readables/hooks/useFindAo3Duplicate';
import type { ProcessedAo3Url } from '../../../shared/utils/ao3Url';
import { useShareSave } from '../hooks/useShareSave';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareHandler'>;

// ── Phase state machine ───────────────────────────────────────────────────────

type SheetPhase =
  | { kind: 'loading' }
  | { kind: 'new'; metadata: MetadataResult['data'] }
  | { kind: 'duplicate'; readable: Readable };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatWordCount(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n >= 1000 ? `${Math.round(n / 1000)}K words` : `${n} words`;
}

function buildChapterSummary(
  availableChapters: number | null | undefined,
  wordCount: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (availableChapters != null) {
    parts.push(availableChapters === 1 ? '1 chapter' : `${availableChapters} chapters`);
  }
  const wc = formatWordCount(wordCount);
  if (wc) parts.push(wc);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShareHandlerScreen({ navigation, route }: Props) {
  const { processedUrl } = route.params;
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<SheetPhase>({ kind: 'loading' });
  const [selectedStatus, setSelectedStatus] = useState<'want_to_read' | 'reading'>(
    processedUrl.hasChapterPath ? 'reading' : 'want_to_read',
  );

  const { importMetadata } = useImportMetadata();
  const { findAo3Duplicate } = useFindAo3Duplicate();
  const { save, isSaving, savedTitle } = useShareSave();

  // Tracks whether a duplicate was found so the metadata callback can be ignored.
  const duplicateFoundRef = useRef(false);
  // Tracks whether the component is still mounted to prevent setState after unmount.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Fetch metadata and check duplicate concurrently on mount ────────────────
  useEffect(() => {
    const { canonicalUrl, workId } = processedUrl;

    // Duplicate check — fast local DB query.
    void (async () => {
      try {
        const duplicate = await findAo3Duplicate(workId);
        if (!mountedRef.current) return;
        if (duplicate) {
          duplicateFoundRef.current = true;
          setPhase({ kind: 'duplicate', readable: duplicate });
        }
      } catch {
        // Fail open — treat as no duplicate, let metadata result determine state.
      }
    })();

    // Metadata fetch — network, can take 1–3 s.
    void (async () => {
      const result = await importMetadata('fanfic', canonicalUrl);
      if (!mountedRef.current) return;
      // If duplicate was already found, don't overwrite that state.
      if (duplicateFoundRef.current) return;
      setPhase({ kind: 'new', metadata: result.data });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Post-save: dismiss and show confirmation ────────────────────────────────
  useEffect(() => {
    if (!savedTitle) return;
    navigation.goBack();
    const displayTitle =
      savedTitle === processedUrl.canonicalUrl ? 'your work' : savedTitle;
    setTimeout(() => {
      Alert.alert('Saved', `Added "${displayTitle}" to your library.`);
    }, 100);
  }, [savedTitle, navigation, processedUrl.canonicalUrl]);

  // ── Derived ────────────────────────────────────────────────────────────────

  function handleSave(status: ReadableStatus, metadata: MetadataResult['data'] | null) {
    void save({ processedUrl, status, metadata });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop: tap to dismiss */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      />

      {/* Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.backgroundCard,
            paddingBottom: insets.bottom + 16,
            ...theme.shadows.card,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: theme.colors.backgroundBorder }]} />

        {/* Source label */}
        <Text style={[styles.sourceLabel, { color: theme.colors.textMeta }]}>
          archiveofourown.org
        </Text>

        {/* Phase content */}
        {phase.kind === 'loading' && (
          <LoadingPhase
            isSaving={isSaving}
            onSave={() => handleSave('want_to_read', null)}
            theme={theme}
          />
        )}
        {phase.kind === 'new' && (
          <NewFicPhase
            metadata={phase.metadata}
            processedUrl={processedUrl}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            isSaving={isSaving}
            onSave={() => handleSave(selectedStatus, phase.metadata)}
            theme={theme}
          />
        )}
        {phase.kind === 'duplicate' && (
          <DuplicatePhase
            readable={phase.readable}
            onViewInBookmark={() => {
              navigation.navigate('ReadableDetail', { id: phase.readable.id });
            }}
            onDismiss={() => navigation.goBack()}
            theme={theme}
          />
        )}
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PhaseProps {
  theme: ReturnType<typeof useAppTheme>;
}

function LoadingPhase({
  isSaving,
  onSave,
  theme,
}: PhaseProps & { isSaving: boolean; onSave: () => void }) {
  return (
    <View style={styles.phaseContainer}>
      <ActivityIndicator
        size="small"
        color={theme.colors.kindFanfic}
        style={styles.spinner}
      />
      <TouchableOpacity
        onPress={onSave}
        disabled={isSaving}
        style={[
          styles.saveButton,
          {
            backgroundColor: theme.colors.kindFanfic,
            opacity: isSaving ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Save as Want to Read"
        accessibilityRole="button"
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save as Want to Read</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function NewFicPhase({
  metadata,
  processedUrl,
  selectedStatus,
  onSelectStatus,
  isSaving,
  onSave,
  theme,
}: PhaseProps & {
  metadata: MetadataResult['data'];
  processedUrl: ProcessedAo3Url;
  selectedStatus: 'want_to_read' | 'reading';
  onSelectStatus: (s: 'want_to_read' | 'reading') => void;
  isSaving: boolean;
  onSave: () => void;
}) {
  const title = metadata.title ?? null;
  const author = metadata.author ?? null;
  const chapterSummary = buildChapterSummary(metadata.availableChapters, metadata.wordCount);

  return (
    <View style={styles.phaseContainer}>
      {/* Title */}
      {title ? (
        <Text
          style={[styles.fictionTitle, { color: theme.colors.textPrimary }]}
          numberOfLines={2}
        >
          {title}
        </Text>
      ) : (
        <Text style={[styles.fictionTitle, { color: theme.colors.textHint }]} numberOfLines={1}>
          {processedUrl.canonicalUrl}
        </Text>
      )}

      {/* Author */}
      {author !== null && (
        <Text style={[styles.fictionMeta, { color: theme.colors.textMeta }]} numberOfLines={1}>
          {author}
        </Text>
      )}

      {/* Chapter summary */}
      {chapterSummary !== null && (
        <Text style={[styles.fictionMeta, { color: theme.colors.textMeta }]} numberOfLines={1}>
          {chapterSummary}
        </Text>
      )}

      {/* Status chips */}
      <View style={styles.chipRow}>
        <StatusChip
          label="Want to Read"
          selected={selectedStatus === 'want_to_read'}
          onPress={() => onSelectStatus('want_to_read')}
          textColor={theme.colors.statusWantText}
          bgColor={theme.colors.statusWantBg}
          borderColor={theme.colors.statusWantBorder}
          inactiveTextColor={theme.colors.textMeta}
          inactiveBgColor={theme.colors.backgroundInput}
          inactiveBorderColor={theme.colors.backgroundBorder}
        />
        <StatusChip
          label="Reading"
          selected={selectedStatus === 'reading'}
          onPress={() => onSelectStatus('reading')}
          textColor={theme.colors.statusReadingText}
          bgColor={theme.colors.statusReadingBg}
          borderColor={theme.colors.statusReadingBorder}
          inactiveTextColor={theme.colors.textMeta}
          inactiveBgColor={theme.colors.backgroundInput}
          inactiveBorderColor={theme.colors.backgroundBorder}
        />
      </View>

      {/* Save button */}
      <TouchableOpacity
        onPress={onSave}
        disabled={isSaving}
        style={[
          styles.saveButton,
          {
            backgroundColor: theme.colors.kindFanfic,
            opacity: isSaving ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Save to library"
        accessibilityRole="button"
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function DuplicatePhase({
  readable,
  onViewInBookmark,
  onDismiss,
  theme,
}: PhaseProps & {
  readable: Readable;
  onViewInBookmark: () => void;
  onDismiss: () => void;
}) {
  const statusColors = getStatusColors(readable.status, theme);

  return (
    <View style={styles.phaseContainer}>
      <Text
        style={[styles.fictionTitle, { color: theme.colors.textPrimary }]}
        numberOfLines={2}
      >
        {readable.title}
      </Text>

      <View style={styles.duplicateStatusRow}>
        <Text style={[styles.duplicateStatusLabel, { color: theme.colors.textMeta }]}>
          Already in library
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColors.bg, borderColor: statusColors.border },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
            {statusLabel(readable.status)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onViewInBookmark}
        style={[
          styles.saveButton,
          { backgroundColor: theme.colors.kindFanfic },
        ]}
        accessibilityLabel="View in Bookmark"
        accessibilityRole="button"
      >
        <Text style={styles.saveButtonText}>View in Bookmark</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismissButton}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      >
        <Text style={[styles.dismissText, { color: theme.colors.textMeta }]}>
          Dismiss
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({
  label,
  selected,
  onPress,
  textColor,
  bgColor,
  borderColor,
  inactiveTextColor,
  inactiveBgColor,
  inactiveBorderColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  textColor: string;
  bgColor: string;
  borderColor: string;
  inactiveTextColor: string;
  inactiveBgColor: string;
  inactiveBorderColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? bgColor : inactiveBgColor,
          borderColor: selected ? borderColor : inactiveBorderColor,
        },
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? textColor : inactiveTextColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function statusLabel(status: ReadableStatus): string {
  switch (status) {
    case 'want_to_read': return 'Want to Read';
    case 'reading': return 'Reading';
    case 'completed': return 'Completed';
    case 'dnf': return 'Did Not Finish';
  }
}

function getStatusColors(
  status: ReadableStatus,
  theme: ReturnType<typeof useAppTheme>,
): { text: string; bg: string; border: string } {
  switch (status) {
    case 'want_to_read':
      return { text: theme.colors.statusWantText, bg: theme.colors.statusWantBg, border: theme.colors.statusWantBorder };
    case 'reading':
      return { text: theme.colors.statusReadingText, bg: theme.colors.statusReadingBg, border: theme.colors.statusReadingBorder };
    case 'completed':
      return { text: theme.colors.statusCompletedText, bg: theme.colors.statusCompletedBg, border: theme.colors.statusCompletedBorder };
    case 'dnf':
      return { text: theme.colors.statusDnfText, bg: theme.colors.statusDnfBg, border: theme.colors.statusDnfBorder };
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  phaseContainer: {
    gap: 10,
    paddingBottom: 4,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  fictionTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
  },
  fictionMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  duplicateStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duplicateStatusLabel: {
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dismissButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 14,
  },
});
