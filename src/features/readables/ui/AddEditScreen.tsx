// src/features/readables/ui/AddEditScreen.tsx
// §10 — Add/edit screen for books and fanfics.
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
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  Portal,
  RadioButton,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { RootStackParamList, AddEditPrefill } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { todayLocalDate } from '../../../shared/utils/dates';
import type { ReadableStatus, AO3Rating, AuthorType } from '../domain/readable';
import { READABLE_STATUSES, STATUS_LABELS_SHORT, AO3_RATING_LABELS } from '../domain/readable';
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
    // isAbandoned is always false here — confirmation alert sets it via setValue if needed.
    isAbandoned: false,
  };
}

function getEditDefaultValues(readable: Readable): AddEditFormValues {
  // Apply isComplete coherence: if a record has isComplete=true but no totalUnits
  // (a broken state), reset isComplete to false so the form opens in a valid state
  // and the user isn't blocked from saving by the superRefine rule.
  const isComplete =
    readable.isComplete === true && readable.totalUnits === null
      ? false
      : readable.isComplete;

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

export function AddEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const isEditMode = id !== undefined;
  const theme = useAppTheme();
  const headerHeight = useHeaderHeight();

  // Prefill — provided by QuickAddReadable in add mode, absent in edit mode.
  const prefill = route.params?.prefill;
  const hasPrefill = prefill !== undefined;
  // wasPrefilled: import actually ran (not a manual skip) — used for "not found" notices.
  const wasPrefilled = hasPrefill && prefill!.sourceType !== 'manual';

  // isAbandoned confirmation gate — only active in add mode when prefill signals abandoned.
  const needsAbandonedConfirmation = !isEditMode && prefill?.isAbandoned === true;
  const [hasConfirmedAbandoned, setHasConfirmedAbandoned] = useState(!needsAbandonedConfirmation);

  // importContext — computed once from stable nav params. null for manual adds and edit mode.
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

  // Fields the import tried but couldn't populate — shown as "Not found in import" notices.
  // Computed once from stable nav params.
  const prefillMissingFields = useMemo<Set<string>>(() => {
    if (!wasPrefilled || !prefill) return new Set();
    const missing = new Set<string>();
    if (!prefill.title) missing.add('title');
    if (prefill.author === null || prefill.author === undefined) missing.add('author');
    if (!prefill.summary) missing.add('summary');
    if (prefill.totalUnits === null || prefill.totalUnits === undefined) {
      missing.add('totalUnits');
    }
    return missing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — nav params don't change during screen lifetime

  const {
    readable: existingReadable,
    isLoading: isLoadingExisting,
    isError: isExistingError,
    error: existingError,
    refetch: refetchExisting,
  } = useReadable(id ?? '');

  // Fandom vocabulary — all unique fandom strings across existing fanfic readables.
  // Computed once; reuses TanStack Query cache from library screen.
  const { readables: allReadables } = useReadables();
  const fandomVocabulary = useMemo<string[]>(() => {
    const all = allReadables
      .filter((r) => r.kind === 'fanfic')
      .flatMap((r) => r.fandom);
    return [...new Set(all)].sort();
  }, [allReadables]);

  const { control, handleSubmit, formState, watch, setValue, reset } =
    useForm<AddEditFormValues, unknown, AddEditFormOutput>({
      resolver: zodResolver(addEditSchema),
      defaultValues:
        !isEditMode && hasPrefill
          ? getPrefillDefaultValues(prefill!)
          : getAddDefaultValues(),
    });

  // isFormReady: false in edit mode until the repository loads the readable.
  // In add mode (with or without prefill), defaults are already computed — starts true.
  const [isFormReady, setIsFormReady] = useState(!isEditMode);
  const hasResetRef = useRef(false);

  useEffect(() => {
    if (isEditMode && existingReadable && !hasResetRef.current) {
      hasResetRef.current = true;
      reset(getEditDefaultValues(existingReadable));
      setIsFormReady(true);
    }
  }, [isEditMode, existingReadable, reset]);

  // isAbandoned confirmation alert — fires once on mount when needed.
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
        {
          text: 'No, keep as WIP',
          onPress: () => setHasConfirmedAbandoned(true),
        },
      ],
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedKind = watch('kind');
  const watchedTotalUnits = watch('totalUnits');
  const watchedIsComplete = watch('isComplete');

  // Sync isComplete when kind changes — only relevant in manual add mode without prefill
  // (kind is locked when prefill is present, so this only fires on unmounted kind changes).
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
  useEffect(() => {
    isDirtyRef.current = formState.isDirty;
  }, [formState.isDirty]);

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

  // Local text state for fandom autocomplete input
  const [fandomInput, setFandomInput] = useState('');

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

    // Split comma-separated relationships string → string[]
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
        // Import-only fields from prefill (not form fields):
        authorType: importContext?.authorType ?? null,
        publishedAt: importContext?.publishedAt ?? null,
        ao3UpdatedAt: importContext?.ao3UpdatedAt ?? null,
        // Shared v2 fields:
        notes: data.notes,
        seriesName: data.seriesName,
        seriesPart: data.seriesPart,
        seriesTotal: data.seriesTotal,
        // Fanfic-only (repo enforces null/[]/false for books):
        wordCount: isFanficSubmit ? (data.wordCount ?? null) : null,
        fandom: isFanficSubmit ? (data.fandom ?? []) : [],
        relationships: isFanficSubmit ? relationshipsArray : [],
        rating: isFanficSubmit ? (data.rating ?? null) : null,
        archiveWarnings: isFanficSubmit ? (data.archiveWarnings ?? []) : [],
        isAbandoned: isFanficSubmit ? (data.isAbandoned ?? false) : false,
      };
      create(createInput, {
        onSuccess: () => {
          savedRef.current = true;
          navigation.popToTop();
        },
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
        // Fanfic-only:
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
          onSuccess: () => {
            savedRef.current = true;
            navigation.goBack();
          },
          onError: (err) => showSnackbar(err.message),
        },
      );
    }
  });

  // ── Error / loading / not-found guards (isError → isLoading → not-found) ──

  if (isEditMode && isExistingError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyMedium" style={[styles.centeredMessage, { color: theme.colors.textSecondary }]}>
          {existingError?.message ?? 'Failed to load readable.'}
        </Text>
        <Button mode="outlined" onPress={refetchExisting}>Try again</Button>
      </View>
    );
  }

  if (!isFormReady || !hasConfirmedAbandoned) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isEditMode && !isLoadingExisting && !existingReadable) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="bodyMedium" style={{ color: theme.colors.textSecondary }}>Readable not found.</Text>
      </View>
    );
  }

  const isFanfic = watchedKind === 'fanfic';
  const progressUnit = isFanfic ? 'chapters' : 'pages';
  const showIsCompleteHint = isFanfic && watchedIsComplete === true && watchedTotalUnits.trim() === '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Kind selector (add mode, no prefill only — kind locked when prefill present) ── */}
        {!isEditMode && !hasPrefill && (
          <View style={styles.section}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Kind *</Text>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={[{ value: 'book', label: 'Book' }, { value: 'fanfic', label: 'Fanfic' }]}
                />
              )}
            />
          </View>
        )}

        {/* ── Title ──────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                label="Title *"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                returnKeyType="next"
                onSubmitEditing={() => authorRef.current?.focus()}
                style={styles.input}
                mode="outlined"
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

        {/* ── Author ─────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="author"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={authorRef}
                label="Author"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                returnKeyType="next"
                onSubmitEditing={() => sourceUrlRef.current?.focus()}
                style={styles.input}
                mode="outlined"
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

        {/* ── Status ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Status *</Text>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedButtons
                value={field.value}
                onValueChange={field.onChange}
                buttons={READABLE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS_SHORT[s] }))}
              />
            )}
          />
        </View>

        {/* ── Source URL ─────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="sourceUrl"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={sourceUrlRef}
                label={isFanfic ? 'AO3 Work URL' : 'Source URL'}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                returnKeyType="next"
                onSubmitEditing={() => progressCurrentRef.current?.focus()}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                mode="outlined"
                accessibilityLabel={isFanfic ? 'AO3 work URL' : 'Source URL'}
              />
              {fieldState.error && (
                <HelperText type="error" visible>{fieldState.error.message}</HelperText>
              )}
            </View>
          )}
        />

        {/* ── Progress ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            Progress ({progressUnit})
          </Text>
          <View style={styles.progressRow}>
            <Controller
              control={control}
              name="progressCurrent"
              render={({ field, fieldState }) => (
                <View style={styles.progressField}>
                  <TextInput
                    ref={progressCurrentRef}
                    label="Current"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => totalUnitsRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
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
                    label="Total"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => isFanfic ? wordCountRef.current?.focus() : summaryRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
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

        {/* ── isComplete toggle (fanfic only) ────────────────────────────────── */}
        {isFanfic && (
          <View style={styles.section}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Completion status</Text>
            <Controller
              control={control}
              name="isComplete"
              render={({ field }) => (
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
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
          </View>
        )}

        {/* ── Fanfic-only fields ──────────────────────────────────────────────── */}
        {isFanfic && (
          <>
            {/* Word count */}
            <Controller
              control={control}
              name="wordCount"
              render={({ field, fieldState }) => (
                <View style={styles.fieldWrapper}>
                  <TextInput
                    ref={wordCountRef}
                    label="Word count"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => summaryRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
                    accessibilityLabel="Word count"
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* isAbandoned switch */}
            <View style={styles.section}>
              <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Abandoned</Text>
              <Controller
                control={control}
                name="isAbandoned"
                render={({ field }) => (
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.textPrimary }}>
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
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
              <Controller
                control={control}
                name="rating"
                render={({ field }) => (
                  <RadioButton.Group
                    value={field.value ?? '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : (v as AO3Rating))}
                  >
                    <View style={styles.radioItem}>
                      <RadioButton.Item
                        label="Not specified"
                        value="__none__"
                        status={field.value == null ? 'checked' : 'unchecked'}
                        labelStyle={{ color: theme.colors.textPrimary }}
                      />
                    </View>
                    {(Object.keys(AO3_RATING_LABELS) as AO3Rating[]).map((r) => (
                      <View key={r} style={styles.radioItem}>
                        <RadioButton.Item
                          label={AO3_RATING_LABELS[r]}
                          value={r}
                          status={field.value === r ? 'checked' : 'unchecked'}
                          labelStyle={{ color: theme.colors.textPrimary }}
                        />
                      </View>
                    ))}
                  </RadioButton.Group>
                )}
              />
            </View>

            {/* Archive warnings */}
            <View style={styles.section}>
              <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Archive warnings</Text>
              <Controller
                control={control}
                name="archiveWarnings"
                render={({ field }) => {
                  const selected = field.value ?? [];
                  return (
                    <View style={styles.chipWrap}>
                      {CANONICAL_ARCHIVE_WARNINGS.map((warning) => {
                        const isSelected = selected.includes(warning);
                        return (
                          <Chip
                            key={warning}
                            selected={isSelected}
                            mode={isSelected ? 'flat' : 'outlined'}
                            onPress={() => {
                              const next = isSelected
                                ? selected.filter((w) => w !== warning)
                                : [...selected, warning];
                              field.onChange(next);
                            }}
                            style={styles.chip}
                            accessibilityLabel={`Archive warning: ${warning}`}
                          >
                            {warning}
                          </Chip>
                        );
                      })}
                    </View>
                  );
                }}
              />
            </View>

            {/* Fandom autocomplete */}
            <View style={styles.section}>
              <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Fandom</Text>
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
                        <View style={[styles.chipWrap, styles.chipWrapBottom]}>
                          {confirmed.map((f) => (
                            <Chip
                              key={f}
                              onClose={() => field.onChange(confirmed.filter((x) => x !== f))}
                              style={styles.chip}
                              accessibilityLabel={`Remove fandom: ${f}`}
                            >
                              {f}
                            </Chip>
                          ))}
                        </View>
                      )}

                      {/* Fandom text input */}
                      <TextInput
                        label="Add fandom"
                        value={fandomInput}
                        onChangeText={setFandomInput}
                        style={styles.input}
                        mode="outlined"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (trimmedInput.length > 0 && !confirmed.includes(trimmedInput)) {
                            appendFandom(trimmedInput);
                          }
                        }}
                        accessibilityLabel="Add fandom"
                      />

                      {/* Suggestions */}
                      {trimmedInput.length > 0 && (
                        <View style={[styles.chipWrap, styles.chipWrapTop]}>
                          {filtered.map((f) => (
                            <Chip
                              key={f}
                              mode="outlined"
                              onPress={() => appendFandom(f)}
                              style={styles.chip}
                              accessibilityLabel={`Add fandom: ${f}`}
                            >
                              {f}
                            </Chip>
                          ))}
                          {isNewEntry && (
                            <Chip
                              mode="outlined"
                              onPress={() => appendFandom(trimmedInput)}
                              style={styles.chip}
                              accessibilityLabel={`Add new fandom: ${trimmedInput}`}
                            >
                              Add: {trimmedInput}
                            </Chip>
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
                <View style={styles.fieldWrapper}>
                  <TextInput
                    ref={relationshipsRef}
                    label="Relationships"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    returnKeyType="next"
                    onSubmitEditing={() => summaryRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
                    accessibilityLabel="Relationships, separate with commas"
                  />
                  <HelperText type="info" visible={!fieldState.error}>Separate with commas</HelperText>
                  {fieldState.error && (
                    <HelperText type="error" visible>{fieldState.error.message}</HelperText>
                  )}
                </View>
              )}
            />
          </>
        )}

        {/* ── Summary ─────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="summary"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={summaryRef}
                label="Summary"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                multiline
                numberOfLines={4}
                style={styles.input}
                mode="outlined"
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

        {/* ── Tags ─────────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="tags"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={tagsRef}
                label="Tags (comma-separated)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                returnKeyType="next"
                onSubmitEditing={() => seriesNameRef.current?.focus()}
                style={styles.input}
                mode="outlined"
                accessibilityLabel="Tags, comma separated"
              />
              {fieldState.error && (
                <HelperText type="error" visible>{fieldState.error.message}</HelperText>
              )}
            </View>
          )}
        />

        {/* ── Series ───────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Series</Text>
          <Controller
            control={control}
            name="seriesName"
            render={({ field, fieldState }) => (
              <View style={styles.fieldWrapper}>
                <TextInput
                  ref={seriesNameRef}
                  label="Series name"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={!!fieldState.error}
                  returnKeyType="next"
                  onSubmitEditing={() => seriesPartRef.current?.focus()}
                  style={styles.input}
                  mode="outlined"
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
                    label="Part"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => seriesTotalRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
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
                    label="Total parts"
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => notesRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
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

        {/* ── Notes ─────────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="notes"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={notesRef}
                label="Notes"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                multiline
                numberOfLines={3}
                returnKeyType="next"
                onSubmitEditing={() => dateAddedRef.current?.focus()}
                style={styles.input}
                mode="outlined"
                accessibilityLabel="Notes"
              />
              <HelperText type="info" visible={!fieldState.error}>Private — not imported from AO3</HelperText>
              {fieldState.error && (
                <HelperText type="error" visible>{fieldState.error.message}</HelperText>
              )}
            </View>
          )}
        />

        {/* ── Date Added ───────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="dateAdded"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput
                ref={dateAddedRef}
                label="Date Added (YYYY-MM-DD)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={!!fieldState.error}
                returnKeyType="done"
                style={styles.input}
                mode="outlined"
                accessibilityLabel="Date added in format YYYY-MM-DD"
              />
              {fieldState.error && (
                <HelperText type="error" visible>{fieldState.error.message}</HelperText>
              )}
            </View>
          )}
        />

        {/* ── Submit button ─────────────────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={onSubmit}
          loading={isSaving}
          disabled={isSaving}
          style={styles.submitButton}
          accessibilityLabel={isEditMode ? 'Save changes' : 'Add to library'}
        >
          {isEditMode ? 'Save Changes' : 'Add to Library'}
        </Button>

      </ScrollView>

      {/* ── Snackbar (save errors only) ───────────────────────────────────────── */}
      <Portal>
        <Snackbar visible={snackbarMessage !== null} onDismiss={hideSnackbar} duration={4000}>
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  centeredMessage: { textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 12 },
  sectionLabel: { marginBottom: 8 },
  fieldWrapper: { marginBottom: 4 },
  input: {},
  progressRow: { flexDirection: 'row', gap: 12 },
  progressField: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  radioItem: {},
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipWrapTop: { marginTop: 8 },
  chipWrapBottom: { marginBottom: 8 },
  chip: {},
  submitButton: { marginTop: 16 },
});
