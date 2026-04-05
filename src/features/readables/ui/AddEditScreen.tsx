// src/features/readables/ui/AddEditScreen.tsx
// UI Phase 4 — Section-card redesign with custom header, input styling, and chip groups.
//
// Modes:
//   Add: reached from QuickAddReadable, which provides an AddEditPrefill in route params.
//        kind is locked to prefill.kind (selector hidden). importContext initialised from prefill.
//        On successful save: navigation.popToTop() returns to Library, dismissing both modals.
//
//   Edit: id present in route params. kind hidden and immutable. Form pre-filled from repository.
//         No import functionality in edit mode. On successful save: navigation.goBack().
//
// "Not found in import" notices:
//   When sourceType !== 'manual', HelperText info notices appear below fields that the
//   import attempted but could not populate (title, author, summary, totalUnits).
//
// isAbandoned confirmation (add mode, prefill.isAbandoned === true):
//   An Alert fires on mount before the form renders. The user confirms whether to mark the
//   work as abandoned. hasConfirmedAbandoned gates form rendering.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Portal,
  Snackbar,
  Switch,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { RootStackParamList, AddEditPrefill } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { AppTheme } from '../../../app/theme/tokens';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { todayLocalDate } from '../../../shared/utils/dates';
import type { ReadableStatus, AO3Rating, AuthorType } from '../domain/readable';
import {
  READABLE_STATUSES,
  STATUS_LABELS_SHORT,
  AO3_RATING_LABELS,
} from '../domain/readable';
import { useReadable } from '../hooks/useReadable';
import { useReadables } from '../hooks/useReadables';
import { useCreateReadable } from '../hooks/useCreateReadable';
import { useUpdateReadable } from '../hooks/useUpdateReadable';
import type { CreateReadableInput } from '../data/readableRepository';
import type { UpdateReadableInput } from '../data/readableRepository';
import type { Readable } from '../domain/readable';
import {
  addEditSchema,
  type AddEditFormValues,
  type AddEditFormOutput,
} from './addEditSchema';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditReadable'>;

/** Canonical AO3 archive warnings — full six values. */
const CANONICAL_ARCHIVE_WARNINGS = [
  'No Archive Warnings Apply',
  'Graphic Depictions Of Violence',
  'Major Character Death',
  'Non-Con',
  'Underage',
  'Choose Not To Use Archive Warnings',
] as const;

/**
 * Tracks which provider was used so the submit handler writes the correct
 * sourceType/sourceId. Also carries import-only fields so they can be
 * persisted without being form fields.
 */
interface ImportContext {
  sourceType: 'ao3' | 'book_provider';
  sourceId: string | null;
  isbn: string | null;
  coverUrl: string | null;
  availableChapters: number | null;
  authorType: AuthorType | null;
  publishedAt: string | null;
  ao3UpdatedAt: string | null;
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getAddDefaultValues(): AddEditFormValues {
  return {
    kind: 'book',
    title: '',
    author: '',
    status: 'want_to_read',
    progressCurrent: '',
    totalUnits: '',
    sourceUrl: '',
    summary: '',
    tags: '',
    isComplete: null,
    dateAdded: todayLocalDate(),
    notes: '',
    seriesName: '',
    seriesPart: '',
    seriesTotal: '',
    wordCount: '',
    fandom: [],
    relationships: '',
    rating: null,
    archiveWarnings: [],
    isAbandoned: false,
  };
}

function getPrefillDefaultValues(prefill: AddEditPrefill): AddEditFormValues {
  return {
    kind: prefill.kind,
    title: prefill.title ?? '',
    author: prefill.author ?? '',
    status: 'want_to_read',
    progressCurrent: '',
    totalUnits: prefill.totalUnits != null ? String(prefill.totalUnits) : '',
    sourceUrl: prefill.sourceUrl ?? '',
    summary: prefill.summary ?? '',
    tags: Array.isArray(prefill.tags) ? prefill.tags.join(', ') : '',
    isComplete: prefill.kind === 'fanfic' ? (prefill.isComplete ?? false) : null,
    dateAdded: todayLocalDate(),
    notes: '',
    seriesName: prefill.seriesName ?? '',
    seriesPart: prefill.seriesPart != null ? String(prefill.seriesPart) : '',
    seriesTotal: prefill.seriesTotal != null ? String(prefill.seriesTotal) : '',
    wordCount: prefill.wordCount != null ? String(prefill.wordCount) : '',
    fandom: prefill.fandom ?? [],
    relationships: Array.isArray(prefill.relationships) ? prefill.relationships.join(', ') : '',
    rating: prefill.rating ?? null,
    archiveWarnings: prefill.archiveWarnings ?? [],
    isAbandoned: false,
  };
}

function getEditDefaultValues(readable: Readable): AddEditFormValues {
  const isComplete =
    readable.isComplete === true && readable.totalUnits === null ? false : readable.isComplete;
  return {
    kind: readable.kind,
    title: readable.title,
    author: readable.author ?? '',
    status: readable.status,
    progressCurrent: readable.progressCurrent != null ? String(readable.progressCurrent) : '',
    totalUnits: readable.totalUnits != null ? String(readable.totalUnits) : '',
    sourceUrl: readable.sourceUrl ?? '',
    summary: readable.summary ?? '',
    tags: readable.tags.join(', '),
    isComplete,
    dateAdded: isoToLocalDate(readable.dateAdded),
    notes: readable.notes ?? '',
    seriesName: readable.seriesName ?? '',
    seriesPart: readable.seriesPart != null ? String(readable.seriesPart) : '',
    seriesTotal: readable.seriesTotal != null ? String(readable.seriesTotal) : '',
    wordCount: readable.wordCount != null ? String(readable.wordCount) : '',
    fandom: readable.fandom,
    relationships: readable.relationships.join(', '),
    rating: readable.rating,
    archiveWarnings: readable.archiveWarnings,
    isAbandoned: readable.isAbandoned,
  };
}

// ── Status token helper ───────────────────────────────────────────────────────

function getStatusTokens(
  status: ReadableStatus,
  theme: AppTheme,
): { bg: string; text: string; border: string } {
  switch (status) {
    case 'reading':
      return { bg: theme.colors.statusReadingBg, text: theme.colors.statusReadingText, border: theme.colors.statusReadingBorder };
    case 'completed':
      return { bg: theme.colors.statusCompletedBg, text: theme.colors.statusCompletedText, border: theme.colors.statusCompletedBorder };
    case 'dnf':
      return { bg: theme.colors.statusDnfBg, text: theme.colors.statusDnfText, border: theme.colors.statusDnfBorder };
    case 'want_to_read':
    default:
      return { bg: theme.colors.statusWantBg, text: theme.colors.statusWantText, border: theme.colors.statusWantBorder };
  }
}

// ── Section card sub-components ───────────────────────────────────────────────

interface SectionCardProps {
  label: string;
  theme: AppTheme;
  children: React.ReactNode;
  fanficOnly?: boolean;
}

function SectionCard({ label, theme, children, fanficOnly }: SectionCardProps) {
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: theme.colors.backgroundCard, ...theme.shadows.card },
      ]}
    >
      {/* Section header */}
      <View
        style={[
          styles.sectionCardHeader,
          { borderBottomColor: theme.colors.backgroundInput },
        ]}
      >
        <View style={styles.sectionCardHeaderLeft}>
          <Text
            style={[styles.sectionCardLabel, { color: theme.colors.textMeta }]}
          >
            {label}
          </Text>
          {fanficOnly && (
            <View
              style={[
                styles.fanficOnlyBadge,
                { backgroundColor: theme.colors.kindFanficSubtle },
              ]}
            >
              <Text style={[styles.fanficOnlyText, { color: theme.colors.kindFanfic }]}>
                FANFIC ONLY
              </Text>
            </View>
          )}
        </View>
      </View>
      {/* Fields */}
      <View style={styles.sectionCardFields}>{children}</View>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const isEditMode = id !== undefined;
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  // Header height — measured via onLayout, used as keyboardVerticalOffset
  const [headerHeight, setHeaderHeight] = useState(0);
  function onHeaderLayout(e: LayoutChangeEvent) {
    setHeaderHeight(e.nativeEvent.layout.height);
  }

  // Focused field tracking — for input styling
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Prefill — provided by QuickAddReadable in add mode, absent in edit mode.
  const prefill = route.params?.prefill;
  const hasPrefill = prefill !== undefined;
  const wasPrefilled = hasPrefill && prefill!.sourceType !== 'manual';

  // isAbandoned confirmation gate
  const needsAbandonedConfirmation = !isEditMode && prefill?.isAbandoned === true;
  const [hasConfirmedAbandoned, setHasConfirmedAbandoned] = useState(!needsAbandonedConfirmation);

  // importContext
  const importContext: ImportContext | null =
    !isEditMode && hasPrefill && prefill!.sourceType !== 'manual'
      ? {
          sourceType: prefill!.sourceType as 'ao3' | 'book_provider',
          sourceId: prefill!.sourceId,
          isbn: prefill!.isbn,
          coverUrl: prefill!.coverUrl,
          availableChapters: prefill!.availableChapters,
          authorType: prefill!.authorType ?? null,
          publishedAt: prefill!.publishedAt ?? null,
          ao3UpdatedAt: prefill!.ao3UpdatedAt ?? null,
        }
      : null;

  const prefillMissingFields = useMemo<Set<string>>(() => {
    if (!wasPrefilled || !prefill) return new Set();
    const missing = new Set<string>();
    if (!prefill.title) missing.add('title');
    if (prefill.author === null || prefill.author === undefined) missing.add('author');
    if (!prefill.summary) missing.add('summary');
    if (prefill.totalUnits === null || prefill.totalUnits === undefined) missing.add('totalUnits');
    return missing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    readable: existingReadable,
    isLoading: isLoadingExisting,
    isError: isExistingError,
    error: existingError,
    refetch: refetchExisting,
  } = useReadable(id ?? '');

  const { readables: allReadables } = useReadables();
  const fandomVocabulary = useMemo<string[]>(() => {
    const all = allReadables.filter((r) => r.kind === 'fanfic').flatMap((r) => r.fandom);
    return [...new Set(all)].sort();
  }, [allReadables]);

  const { control, handleSubmit, formState, watch, setValue, reset } =
    useForm<AddEditFormValues, unknown, AddEditFormOutput>({
      resolver: zodResolver(addEditSchema),
      defaultValues:
        !isEditMode && hasPrefill ? getPrefillDefaultValues(prefill!) : getAddDefaultValues(),
    });

  const [isFormReady, setIsFormReady] = useState(!isEditMode);
  const hasResetRef = useRef(false);

  useEffect(() => {
    if (isEditMode && existingReadable && !hasResetRef.current) {
      hasResetRef.current = true;
      reset(getEditDefaultValues(existingReadable));
      setIsFormReady(true);
    }
  }, [isEditMode, existingReadable, reset]);

  // isAbandoned confirmation alert
  const abandonedAlertFiredRef = useRef(false);
  useEffect(() => {
    if (!needsAbandonedConfirmation || abandonedAlertFiredRef.current) return;
    abandonedAlertFiredRef.current = true;
    Alert.alert(
      'Abandoned work',
      'This work is tagged Abandoned on AO3. Mark it as abandoned in your library?',
      [
        {
          text: 'Yes, mark as abandoned',
          onPress: () => {
            setValue('isAbandoned', true, { shouldDirty: false });
            setHasConfirmedAbandoned(true);
          },
        },
        { text: 'No, keep as WIP', onPress: () => setHasConfirmedAbandoned(true) },
      ],
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedKind = watch('kind');
  const watchedTotalUnits = watch('totalUnits');
  const watchedIsComplete = watch('isComplete');

  useEffect(() => {
    if (!isEditMode && !hasPrefill) {
      setValue('isComplete', watchedKind === 'fanfic' ? false : null, { shouldDirty: false });
    }
  }, [watchedKind, isEditMode, hasPrefill, setValue]);

  const { create, isPending: isCreating } = useCreateReadable();
  const { update, isPending: isUpdating } = useUpdateReadable();
  const isSaving = isCreating || isUpdating;

  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  const savedRef = useRef(false);
  const isDirtyRef = useRef(formState.isDirty);
  useEffect(() => { isDirtyRef.current = formState.isDirty; }, [formState.isDirty]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current || savedRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. They will be lost if you go back.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ],
      );
    });
    return unsubscribe;
  }, [navigation]);

  const [fandomInput, setFandomInput] = useState('');

  // Refs for focus chain
  const authorRef = useRef<RNTextInput>(null);
  const sourceUrlRef = useRef<RNTextInput>(null);
  const progressCurrentRef = useRef<RNTextInput>(null);
  const totalUnitsRef = useRef<RNTextInput>(null);
  const wordCountRef = useRef<RNTextInput>(null);
  const relationshipsRef = useRef<RNTextInput>(null);
  const summaryRef = useRef<RNTextInput>(null);
  const tagsRef = useRef<RNTextInput>(null);
  const seriesNameRef = useRef<RNTextInput>(null);
  const seriesPartRef = useRef<RNTextInput>(null);
  const seriesTotalRef = useRef<RNTextInput>(null);
  const notesRef = useRef<RNTextInput>(null);
  const dateAddedRef = useRef<RNTextInput>(null);

  const onSubmit = handleSubmit((data: AddEditFormOutput) => {
    const isoDateAdded = new Date(data.dateAdded + 'T00:00:00.000Z').toISOString();
    const isFanficSubmit = data.kind === 'fanfic';
    const relationshipsArray = data.relationships
      ? data.relationships.split(',').map((r) => r.trim()).filter(Boolean)
      : [];

    if (!isEditMode) {
      const createInput: CreateReadableInput = {
        kind: data.kind,
        title: data.title,
        author: data.author,
        status: data.status,
        progressCurrent: data.progressCurrent,
        totalUnits: data.totalUnits,
        sourceType: importContext?.sourceType ?? 'manual',
        sourceUrl: data.sourceUrl,
        sourceId: importContext?.sourceId ?? null,
        summary: data.summary,
        tags: data.tags,
        isComplete: isFanficSubmit ? data.isComplete : null,
        dateAdded: isoDateAdded,
        isbn: importContext?.isbn ?? null,
        coverUrl: importContext?.coverUrl ?? null,
        availableChapters: importContext?.availableChapters ?? null,
        authorType: importContext?.authorType ?? null,
        publishedAt: importContext?.publishedAt ?? null,
        ao3UpdatedAt: importContext?.ao3UpdatedAt ?? null,
        notes: data.notes,
        seriesName: data.seriesName,
        seriesPart: data.seriesPart,
        seriesTotal: data.seriesTotal,
        wordCount: isFanficSubmit ? (data.wordCount ?? null) : null,
        fandom: isFanficSubmit ? (data.fandom ?? []) : [],
        relationships: isFanficSubmit ? relationshipsArray : [],
        rating: isFanficSubmit ? (data.rating ?? null) : null,
        archiveWarnings: isFanficSubmit ? (data.archiveWarnings ?? []) : [],
        isAbandoned: isFanficSubmit ? (data.isAbandoned ?? false) : false,
      };
      create(createInput, {
        onSuccess: () => { savedRef.current = true; navigation.popToTop(); },
        onError: (err) => showSnackbar(err.message),
      });
    } else if (existingReadable) {
      const isFanficEdit = existingReadable.kind === 'fanfic';
      const updateInput: UpdateReadableInput = {
        title: data.title,
        author: data.author,
        status: data.status,
        progressCurrent: data.progressCurrent,
        totalUnits: data.totalUnits,
        sourceUrl: data.sourceUrl,
        summary: data.summary,
        tags: data.tags,
        isComplete: isFanficEdit ? data.isComplete : null,
        dateAdded: isoDateAdded,
        notes: data.notes,
        seriesName: data.seriesName,
        seriesPart: data.seriesPart,
        seriesTotal: data.seriesTotal,
        wordCount: isFanficEdit ? (data.wordCount ?? null) : null,
        fandom: isFanficEdit ? (data.fandom ?? []) : [],
        relationships: isFanficEdit ? relationshipsArray : [],
        rating: isFanficEdit ? (data.rating ?? null) : null,
        archiveWarnings: isFanficEdit ? (data.archiveWarnings ?? []) : [],
        isAbandoned: isFanficEdit ? (data.isAbandoned ?? false) : false,
      };
      update(
        { id: existingReadable.id, input: updateInput, current: existingReadable },
        {
          onSuccess: () => { savedRef.current = true; navigation.goBack(); },
          onError: (err) => showSnackbar(err.message),
        },
      );
    }
  });

  // ── Guards ────────────────────────────────────────────────────────────────

  if (isEditMode && isExistingError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.backgroundPage }]}>
        <Text style={[styles.centeredMessage, { color: theme.colors.textBody }]}>
          {existingError?.message ?? 'Failed to load readable.'}
        </Text>
        <Button mode="outlined" onPress={refetchExisting}>Try again</Button>
      </View>
    );
  }

  if (!isFormReady || !hasConfirmedAbandoned) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.backgroundPage }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isEditMode && !isLoadingExisting && !existingReadable) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.backgroundPage }]}>
        <Text style={{ color: theme.colors.textBody }}>Readable not found.</Text>
      </View>
    );
  }

  const isFanfic = watchedKind === 'fanfic';
  const progressUnit = isFanfic ? 'chapters' : 'pages';
  const showIsCompleteHint = isFanfic && watchedIsComplete === true && watchedTotalUnits.trim() === '';

  // Derived header title
  const headerTitle = isEditMode
    ? 'Edit'
    : isFanfic
    ? 'Add Fanfic'
    : 'Add Book';

  // ── Input styling helper ──────────────────────────────────────────────────

  function inputOutlineStyle(fieldName: string) {
    const focused = focusedField === fieldName;
    return {
      borderColor: focused ? theme.colors.kindBook : theme.colors.backgroundBorder,
      borderRadius: 11,
      borderWidth: 1.5,
    };
  }

  function inputContentStyle(fieldName: string) {
    const focused = focusedField === fieldName;
    return {
      backgroundColor: focused ? theme.colors.backgroundCard : theme.colors.backgroundInput,
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}>
      {/* ── Custom header ──────────────────────────────────────────────────── */}
      <View
        onLayout={onHeaderLayout}
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: theme.colors.backgroundPage,
            borderBottomColor: theme.colors.backgroundBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text style={[styles.headerButtonText, { color: theme.colors.kindBook }]}>Cancel</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {headerTitle}
        </Text>

        <TouchableOpacity
          onPress={onSubmit}
          disabled={isSaving}
          style={styles.headerButton}
          accessibilityLabel={isEditMode ? 'Save changes' : 'Add to library'}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.headerSaveText,
              { color: isSaving ? theme.colors.textMeta : theme.colors.kindBook },
            ]}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── BASICS CARD ─────────────────────────────────────────────────── */}
          <SectionCard label="BASICS" theme={theme}>

            {/* Kind selector — add mode, no prefill only */}
            {!isEditMode && !hasPrefill && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>KIND</Text>
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <View style={styles.chipRow}>
                      {(['book', 'fanfic'] as const).map((k) => {
                        const isActive = field.value === k;
                        const activeBg = k === 'book' ? theme.colors.kindBookSubtle : theme.colors.kindFanficSubtle;
                        const activeBorder = k === 'book' ? theme.colors.kindBookBorder : theme.colors.kindFanficBorder;
                        const activeText = k === 'book' ? theme.colors.kindBook : theme.colors.kindFanfic;
                        return (
                          <TouchableOpacity
                            key={k}
                            onPress={() => field.onChange(k)}
                            style={[
                              styles.statusChip,
                              {
                                backgroundColor: isActive ? activeBg : theme.colors.backgroundInput,
                                borderColor: isActive ? activeBorder : theme.colors.backgroundBorder,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                {
                                  color: isActive ? activeText : theme.colors.textBody,
                                  fontWeight: isActive ? '600' : '500',
                                },
                              ]}
                            >
                              {k === 'book' ? 'Book' : 'Fanfic'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                />
              </View>
            )}

            {/* Title */}
            <Controller
              control={control}
              name="title"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>TITLE *</Text>
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('title')}
                    error={!!fieldState.error}
                    returnKeyType="next"
                    onSubmitEditing={() => authorRef.current?.focus()}
                    mode="outlined"
                    placeholder="Title"
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('title')}
                    contentStyle={inputContentStyle('title')}
                    accessibilityLabel="Title, required"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                  {!fieldState.error && prefillMissingFields.has('title') && (
                    <HelperText type="info" visible>Not found in import — please enter a title.</HelperText>
                  )}
                </View>
              )}
            />

            {/* Author */}
            <Controller
              control={control}
              name="author"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>AUTHOR</Text>
                  <TextInput
                    ref={authorRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('author')}
                    error={!!fieldState.error}
                    returnKeyType="next"
                    onSubmitEditing={() => sourceUrlRef.current?.focus()}
                    mode="outlined"
                    placeholder="Author"
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('author')}
                    contentStyle={inputContentStyle('author')}
                    accessibilityLabel="Author"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                  {!fieldState.error && prefillMissingFields.has('author') && (
                    <HelperText type="info" visible>Not found in import</HelperText>
                  )}
                </View>
              )}
            />

            {/* Source URL */}
            <Controller
              control={control}
              name="sourceUrl"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                    {isFanfic ? 'AO3 WORK URL' : 'SOURCE URL'}
                  </Text>
                  <TextInput
                    ref={sourceUrlRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('sourceUrl')}
                    error={!!fieldState.error}
                    returnKeyType="next"
                    onSubmitEditing={() => progressCurrentRef.current?.focus()}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    mode="outlined"
                    placeholder={isFanfic ? 'https://archiveofourown.org/works/...' : 'https://...'}
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('sourceUrl')}
                    contentStyle={inputContentStyle('sourceUrl')}
                    accessibilityLabel={isFanfic ? 'AO3 work URL' : 'Source URL'}
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Summary */}
            <Controller
              control={control}
              name="summary"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>SUMMARY</Text>
                  <TextInput
                    ref={summaryRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('summary')}
                    error={!!fieldState.error}
                    multiline
                    numberOfLines={4}
                    mode="outlined"
                    placeholder="Brief summary..."
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('summary')}
                    contentStyle={[inputContentStyle('summary'), styles.multilineContent]}
                    accessibilityLabel="Summary"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                  {!fieldState.error && prefillMissingFields.has('summary') && (
                    <HelperText type="info" visible>Not found in import</HelperText>
                  )}
                </View>
              )}
            />
          </SectionCard>

          {/* ── STATUS & PROGRESS CARD ──────────────────────────────────────── */}
          <SectionCard label="STATUS & PROGRESS" theme={theme}>

            {/* Status chips */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>STATUS *</Text>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>
                    {READABLE_STATUSES.map((s) => {
                      const isActive = field.value === s;
                      const tok = getStatusTokens(s, theme);
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => field.onChange(s)}
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor: isActive ? tok.bg : theme.colors.backgroundInput,
                              borderColor: isActive ? tok.border : theme.colors.backgroundBorder,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color: isActive ? tok.text : theme.colors.textBody,
                                fontWeight: isActive ? '600' : '500',
                              },
                            ]}
                          >
                            {STATUS_LABELS_SHORT[s]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              />
            </View>

            {/* Progress */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                {`PROGRESS (${progressUnit.toUpperCase()})`}
              </Text>
              <View style={styles.progressRow}>
                <Controller
                  control={control}
                  name="progressCurrent"
                  render={({ field, fieldState }) => (
                    <View style={styles.progressField}>
                      <TextInput
                        ref={progressCurrentRef}
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('progressCurrent')}
                        error={!!fieldState.error}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => totalUnitsRef.current?.focus()}
                        mode="outlined"
                        placeholder="Current"
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('progressCurrent')}
                        contentStyle={inputContentStyle('progressCurrent')}
                        accessibilityLabel={`Current ${progressUnit}`}
                      />
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="totalUnits"
                  render={({ field, fieldState }) => (
                    <View style={styles.progressField}>
                      <TextInput
                        ref={totalUnitsRef}
                        value={field.value}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('totalUnits')}
                        error={!!fieldState.error}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onSubmitEditing={() =>
                          isFanfic ? wordCountRef.current?.focus() : seriesNameRef.current?.focus()
                        }
                        mode="outlined"
                        placeholder="Total"
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('totalUnits')}
                        contentStyle={inputContentStyle('totalUnits')}
                        accessibilityLabel={`Total ${progressUnit}`}
                      />
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                      {!fieldState.error && showIsCompleteHint && (
                        <HelperText type="info" visible>Set total chapters to mark as complete</HelperText>
                      )}
                      {!fieldState.error && !showIsCompleteHint && prefillMissingFields.has('totalUnits') && (
                        <HelperText type="info" visible>Not found in import</HelperText>
                      )}
                    </View>
                  )}
                />
              </View>
            </View>

            {/* isComplete (fanfic only) */}
            {isFanfic && (
              <Controller
                control={control}
                name="isComplete"
                render={({ field }) => (
                  <View
                    style={[
                      styles.switchRow,
                      { borderBottomColor: theme.colors.backgroundInput },
                    ]}
                  >
                    <Text style={[styles.switchLabel, { color: theme.colors.textPrimary }]}>
                      {field.value === true ? 'Complete' : 'WIP (work in progress)'}
                    </Text>
                    <Switch
                      value={field.value === true}
                      onValueChange={(v) => field.onChange(v)}
                      accessibilityLabel="Mark as complete"
                    />
                  </View>
                )}
              />
            )}

            {/* Fanfic-only fields */}
            {isFanfic && (
              <>
                {/* Word count */}
                <Controller
                  control={control}
                  name="wordCount"
                  render={({ field, fieldState }) => (
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                        WORD COUNT
                      </Text>
                      <TextInput
                        ref={wordCountRef}
                        value={field.value ?? ''}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('wordCount')}
                        error={!!fieldState.error}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => relationshipsRef.current?.focus()}
                        mode="outlined"
                        placeholder="e.g. 50000"
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('wordCount')}
                        contentStyle={inputContentStyle('wordCount')}
                        accessibilityLabel="Word count"
                      />
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                    </View>
                  )}
                />

                {/* isAbandoned */}
                <Controller
                  control={control}
                  name="isAbandoned"
                  render={({ field }) => (
                    <View
                      style={[
                        styles.switchRow,
                        { borderBottomColor: theme.colors.backgroundInput },
                      ]}
                    >
                      <Text style={[styles.switchLabel, { color: theme.colors.textPrimary }]}>
                        {field.value ? 'Marked as abandoned' : 'Not abandoned'}
                      </Text>
                      <Switch
                        value={field.value === true}
                        onValueChange={(v) => field.onChange(v)}
                        accessibilityLabel="Mark as abandoned"
                      />
                    </View>
                  )}
                />

                {/* Rating chips */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>RATING</Text>
                  <Controller
                    control={control}
                    name="rating"
                    render={({ field }) => (
                      <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>
                        {/* "Not specified" option */}
                        <TouchableOpacity
                          onPress={() => field.onChange(null)}
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor:
                                field.value === null
                                  ? theme.colors.kindBookSubtle
                                  : theme.colors.backgroundInput,
                              borderColor:
                                field.value === null
                                  ? theme.colors.kindBookBorder
                                  : theme.colors.backgroundBorder,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: field.value === null }}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color:
                                  field.value === null
                                    ? theme.colors.kindBook
                                    : theme.colors.textBody,
                                fontWeight: field.value === null ? '600' : '500',
                              },
                            ]}
                          >
                            Not specified
                          </Text>
                        </TouchableOpacity>
                        {(Object.keys(AO3_RATING_LABELS) as AO3Rating[]).map((r) => {
                          const isActive = field.value === r;
                          return (
                            <TouchableOpacity
                              key={r}
                              onPress={() => field.onChange(r)}
                              style={[
                                styles.statusChip,
                                {
                                  backgroundColor: isActive
                                    ? theme.colors.kindBookSubtle
                                    : theme.colors.backgroundInput,
                                  borderColor: isActive
                                    ? theme.colors.kindBookBorder
                                    : theme.colors.backgroundBorder,
                                },
                              ]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isActive }}
                            >
                              <Text
                                style={[
                                  styles.statusChipText,
                                  {
                                    color: isActive ? theme.colors.kindBook : theme.colors.textBody,
                                    fontWeight: isActive ? '600' : '500',
                                  },
                                ]}
                              >
                                {AO3_RATING_LABELS[r]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  />
                </View>

                {/* Archive warnings */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                    ARCHIVE WARNINGS
                  </Text>
                  <Controller
                    control={control}
                    name="archiveWarnings"
                    render={({ field }) => {
                      const selected = field.value ?? [];
                      return (
                        <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>
                          {CANONICAL_ARCHIVE_WARNINGS.map((warning) => {
                            const isSelected = selected.includes(warning);
                            return (
                              <TouchableOpacity
                                key={warning}
                                onPress={() => {
                                  const next = isSelected
                                    ? selected.filter((w) => w !== warning)
                                    : [...selected, warning];
                                  field.onChange(next);
                                }}
                                style={[
                                  styles.statusChip,
                                  {
                                    backgroundColor: isSelected
                                      ? theme.colors.dangerSubtle
                                      : theme.colors.backgroundInput,
                                    borderColor: isSelected
                                      ? theme.colors.dangerBorder
                                      : theme.colors.backgroundBorder,
                                  },
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                accessibilityLabel={`Archive warning: ${warning}`}
                              >
                                <Text
                                  style={[
                                    styles.statusChipText,
                                    {
                                      color: isSelected
                                        ? theme.colors.danger
                                        : theme.colors.textBody,
                                      fontWeight: isSelected ? '600' : '500',
                                    },
                                  ]}
                                >
                                  {warning}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    }}
                  />
                </View>

                {/* Fandom autocomplete */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>FANDOM</Text>
                  <Controller
                    control={control}
                    name="fandom"
                    render={({ field }) => {
                      const confirmed = field.value ?? [];
                      const trimmedInput = fandomInput.trim();
                      const filtered = fandomVocabulary.filter(
                        (f) =>
                          f.toLowerCase().includes(trimmedInput.toLowerCase()) &&
                          !confirmed.includes(f),
                      );
                      const isNewEntry =
                        trimmedInput.length > 0 &&
                        !fandomVocabulary.some(
                          (f) => f.toLowerCase() === trimmedInput.toLowerCase(),
                        ) &&
                        !confirmed.includes(trimmedInput);

                      const appendFandom = (value: string) => {
                        field.onChange([...confirmed, value]);
                        setFandomInput('');
                      };

                      return (
                        <>
                          {/* Confirmed fandom chips */}
                          {confirmed.length > 0 && (
                            <View style={[styles.chipRow, { flexWrap: 'wrap', marginBottom: 8 }]}>
                              {confirmed.map((f) => (
                                <TouchableOpacity
                                  key={f}
                                  onPress={() =>
                                    field.onChange(confirmed.filter((x) => x !== f))
                                  }
                                  style={[
                                    styles.statusChip,
                                    {
                                      backgroundColor: theme.colors.kindFanficSubtle,
                                      borderColor: theme.colors.kindFanficBorder,
                                    },
                                  ]}
                                  accessibilityLabel={`Remove fandom: ${f}`}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.statusChipText,
                                      { color: theme.colors.kindFanfic, fontWeight: '500' },
                                    ]}
                                  >
                                    {f} ×
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {/* Fandom input */}
                          <TextInput
                            value={fandomInput}
                            onChangeText={setFandomInput}
                            onBlur={() => setFocusedField(null)}
                            onFocus={() => setFocusedField('fandom')}
                            mode="outlined"
                            placeholder="Search or add fandom"
                            placeholderTextColor={theme.colors.textHint}
                            returnKeyType="done"
                            onSubmitEditing={() => {
                              if (trimmedInput.length > 0 && !confirmed.includes(trimmedInput)) {
                                appendFandom(trimmedInput);
                              }
                            }}
                            outlineStyle={inputOutlineStyle('fandom')}
                            contentStyle={inputContentStyle('fandom')}
                            accessibilityLabel="Add fandom"
                          />

                          {/* Suggestions */}
                          {trimmedInput.length > 0 && (
                            <View style={[styles.chipRow, { flexWrap: 'wrap', marginTop: 8 }]}>
                              {filtered.map((f) => (
                                <TouchableOpacity
                                  key={f}
                                  onPress={() => appendFandom(f)}
                                  style={[
                                    styles.statusChip,
                                    {
                                      backgroundColor: theme.colors.backgroundInput,
                                      borderColor: theme.colors.backgroundBorder,
                                    },
                                  ]}
                                  accessibilityLabel={`Add fandom: ${f}`}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.statusChipText,
                                      { color: theme.colors.textBody },
                                    ]}
                                  >
                                    {f}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                              {isNewEntry && (
                                <TouchableOpacity
                                  onPress={() => appendFandom(trimmedInput)}
                                  style={[
                                    styles.statusChip,
                                    {
                                      backgroundColor: theme.colors.backgroundInput,
                                      borderColor: theme.colors.kindFanficBorder,
                                      borderStyle: 'dashed',
                                    },
                                  ]}
                                  accessibilityLabel={`Add new fandom: ${trimmedInput}`}
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      styles.statusChipText,
                                      { color: theme.colors.kindFanfic },
                                    ]}
                                  >
                                    Add: {trimmedInput}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </>
                      );
                    }}
                  />
                </View>

                {/* Relationships */}
                <Controller
                  control={control}
                  name="relationships"
                  render={({ field, fieldState }) => (
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                        RELATIONSHIPS
                      </Text>
                      <TextInput
                        ref={relationshipsRef}
                        value={field.value ?? ''}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('relationships')}
                        error={!!fieldState.error}
                        returnKeyType="next"
                        onSubmitEditing={() => summaryRef.current?.focus()}
                        mode="outlined"
                        placeholder="Character A/Character B, ..."
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('relationships')}
                        contentStyle={inputContentStyle('relationships')}
                        accessibilityLabel="Relationships, separate with commas"
                      />
                      <HelperText type="info" visible={!fieldState.error}>
                        Separate with commas
                      </HelperText>
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                    </View>
                  )}
                />
              </>
            )}
          </SectionCard>

          {/* ── NOTES & META CARD ───────────────────────────────────────────── */}
          <SectionCard label="NOTES & META" theme={theme}>

            {/* Series */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>SERIES</Text>
              <Controller
                control={control}
                name="seriesName"
                render={({ field, fieldState }) => (
                  <View style={{ marginBottom: 8 }}>
                    <TextInput
                      ref={seriesNameRef}
                      value={field.value ?? ''}
                      onChangeText={field.onChange}
                      onBlur={() => { field.onBlur(); setFocusedField(null); }}
                      onFocus={() => setFocusedField('seriesName')}
                      error={!!fieldState.error}
                      returnKeyType="next"
                      onSubmitEditing={() => seriesPartRef.current?.focus()}
                      mode="outlined"
                      placeholder="Series name"
                      placeholderTextColor={theme.colors.textHint}
                      outlineStyle={inputOutlineStyle('seriesName')}
                      contentStyle={inputContentStyle('seriesName')}
                      accessibilityLabel="Series name"
                    />
                    {fieldState.error && (
                      <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                    )}
                  </View>
                )}
              />
              <View style={styles.progressRow}>
                <Controller
                  control={control}
                  name="seriesPart"
                  render={({ field, fieldState }) => (
                    <View style={styles.progressField}>
                      <TextInput
                        ref={seriesPartRef}
                        value={field.value ?? ''}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('seriesPart')}
                        error={!!fieldState.error}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => seriesTotalRef.current?.focus()}
                        mode="outlined"
                        placeholder="Part"
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('seriesPart')}
                        contentStyle={inputContentStyle('seriesPart')}
                        accessibilityLabel="Series part number"
                      />
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="seriesTotal"
                  render={({ field, fieldState }) => (
                    <View style={styles.progressField}>
                      <TextInput
                        ref={seriesTotalRef}
                        value={field.value ?? ''}
                        onChangeText={field.onChange}
                        onBlur={() => { field.onBlur(); setFocusedField(null); }}
                        onFocus={() => setFocusedField('seriesTotal')}
                        error={!!fieldState.error}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        onSubmitEditing={() => tagsRef.current?.focus()}
                        mode="outlined"
                        placeholder="Total"
                        placeholderTextColor={theme.colors.textHint}
                        outlineStyle={inputOutlineStyle('seriesTotal')}
                        contentStyle={inputContentStyle('seriesTotal')}
                        accessibilityLabel="Series total parts"
                      />
                      {fieldState.error && (
                        <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                      )}
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Tags */}
            <Controller
              control={control}
              name="tags"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>TAGS</Text>
                  <TextInput
                    ref={tagsRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('tags')}
                    error={!!fieldState.error}
                    returnKeyType="next"
                    onSubmitEditing={() => notesRef.current?.focus()}
                    mode="outlined"
                    placeholder="tag1, tag2, tag3"
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('tags')}
                    contentStyle={inputContentStyle('tags')}
                    accessibilityLabel="Tags, comma separated"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Notes */}
            <Controller
              control={control}
              name="notes"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>NOTES</Text>
                  <TextInput
                    ref={notesRef}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('notes')}
                    error={!!fieldState.error}
                    multiline
                    numberOfLines={3}
                    returnKeyType="next"
                    onSubmitEditing={() => dateAddedRef.current?.focus()}
                    mode="outlined"
                    placeholder="Private notes..."
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('notes')}
                    contentStyle={[inputContentStyle('notes'), styles.multilineContent]}
                    accessibilityLabel="Notes"
                  />
                  <HelperText type="info" visible={!fieldState.error}>
                    Private — not imported from AO3
                  </HelperText>
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Date Added */}
            <Controller
              control={control}
              name="dateAdded"
              render={({ field, fieldState }) => (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>
                    DATE ADDED
                  </Text>
                  <TextInput
                    ref={dateAddedRef}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={() => { field.onBlur(); setFocusedField(null); }}
                    onFocus={() => setFocusedField('dateAdded')}
                    error={!!fieldState.error}
                    returnKeyType="done"
                    mode="outlined"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textHint}
                    outlineStyle={inputOutlineStyle('dateAdded')}
                    contentStyle={inputContentStyle('dateAdded')}
                    accessibilityLabel="Date added in format YYYY-MM-DD"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />
          </SectionCard>

          {/* ── Save button ────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isSaving}
            style={[
              styles.saveButton,
              {
                backgroundColor: theme.colors.kindBook,
                ...theme.shadows.button,
                opacity: isSaving ? 0.7 : 1,
              },
            ]}
            accessibilityLabel={isEditMode ? 'Save changes' : 'Add to library'}
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Save Changes' : 'Add to Library'}
              </Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Snackbar ────────────────────────────────────────────────────────── */}
      <Portal>
        <Snackbar visible={snackbarMessage !== null} onDismiss={hideSnackbar} duration={4000}>
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

  // Custom header
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { minHeight: 44, justifyContent: 'center' },
  headerButtonText: { fontSize: 13, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  headerSaveText: { fontSize: 13, fontWeight: '600' },

  // ScrollView
  scrollContent: { padding: 14, gap: 9 },

  // Section cards
  sectionCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  sectionCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fanficOnlyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fanficOnlyText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
  sectionCardFields: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, gap: 8 },

  // Field groups
  fieldGroup: { gap: 4 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Multiline input min-height
  multilineContent: { minHeight: 72 },

  // Progress row
  progressRow: { flexDirection: 'row', gap: 12 },
  progressField: { flex: 1 },

  // Status/rating/warning chips
  chipRow: { flexDirection: 'row', gap: 6 },
  statusChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChipText: { fontSize: 12 },

  // Switch rows
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 10,
    minHeight: 44,
  },
  switchLabel: { fontSize: 14, flex: 1 },

  // Save button
  saveButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
