// src/features/readables/ui/AddEditScreen.tsx
// §10 — Add/edit screen for books and fanfics.
//
// Modes:
//   Add: id absent from route params. kind selector visible. sourceType = 'manual'
//        unless the user imports metadata (then 'ao3' or 'book_provider').
//   Edit: id present. kind hidden and immutable. Form pre-filled from repository.
//         No import functionality in edit mode.
//
// Form rules (§10):
//   - Controller for every React Native Paper input.
//   - Progress fields: string TextInput → number | null via Zod transform.
//   - keyboardType="number-pad" for progress fields.
//   - KeyboardAvoidingView: padding on iOS, height on Android.
//   - Content wrapped in ScrollView.
//   - Focus chaining: title → author → sourceUrl → progressCurrent → progressTotal
//     → summary → tags → dateAdded (→ done).
//   - beforeRemove listener for unsaved changes guard.
//   - Validate on submit only.
//   - Snackbar for mutation errors.
//   - isComplete toggle shown only when kind = 'fanfic'.
//
// keyboardVerticalOffset uses useHeaderHeight() from @react-navigation/elements
// for the exact rendered header height on every device.
//
// Metadata import (add mode only, §6):
//   - Book: search-query TextInput + "Search Google Books" button above the form.
//   - Fanfic: "Import from AO3" button below the Source URL field (reads that field).
//   - On success: prefill form fields; show snackbar if partial errors.
//   - On total failure: show snackbar; user continues with manual entry.
//   - AO3: duplicate detected → Alert with "Open existing" / "Continue anyway" / "Cancel".
//   - importContext tracks sourceType/sourceId for the submit handler.
//   - Resets when kind changes (book ↔ fanfic) in add mode.

import React, { useEffect, useRef, useState } from 'react';
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
  HelperText,
  Portal,
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

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { ReadableStatus } from '../domain/readable';
import { READABLE_STATUSES } from '../domain/readable';
import { useReadable } from '../hooks/useReadable';
import { useCreateReadable } from '../hooks/useCreateReadable';
import { useUpdateReadable } from '../hooks/useUpdateReadable';
import { useFindAo3Duplicate } from '../hooks/useFindAo3Duplicate';
import type { CreateReadableInput } from '../data/readableRepository';
import type { UpdateReadableInput } from '../data/readableRepository';
import type { Readable } from '../domain/readable';
import {
  addEditSchema,
  todayLocalDate,
  type AddEditFormValues,
  type AddEditFormOutput,
} from './addEditSchema';
import { useImportMetadata } from '../../metadata';
import type { MetadataResult } from '../../metadata';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditReadable'>;

/** Tracks which provider was used so the submit handler writes the correct sourceType/sourceId. */
interface ImportContext {
  sourceType: 'ao3' | 'book_provider';
  sourceId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a stored ISO 8601 string to YYYY-MM-DD using the device's local
 * timezone. Safe to use now that the repository always writes midnight UTC of
 * the local calendar date (localMidnightUTC), so getFullYear/Month/Date
 * return the correct local calendar day on both read and write.
 */
function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want',
  reading: 'Reading',
  completed: 'Done',
  dnf: 'DNF',
};

// ── Default values ────────────────────────────────────────────────────────────

function getAddDefaultValues(): AddEditFormValues {
  return {
    kind: 'book',
    title: '',
    author: '',
    status: 'want_to_read',
    progressCurrent: '',
    progressTotal: '',
    sourceUrl: '',
    summary: '',
    tags: '',
    isComplete: null,
    dateAdded: todayLocalDate(),
  };
}

function getEditDefaultValues(readable: Readable): AddEditFormValues {
  return {
    kind: readable.kind,
    title: readable.title,
    author: readable.author ?? '',
    status: readable.status,
    progressCurrent:
      readable.progressCurrent != null ? String(readable.progressCurrent) : '',
    progressTotal:
      readable.progressTotal != null ? String(readable.progressTotal) : '',
    sourceUrl: readable.sourceUrl ?? '',
    summary: readable.summary ?? '',
    // Comma-separated tags for the single text field
    tags: readable.tags.join(', '),
    isComplete: readable.isComplete,
    dateAdded: isoToLocalDate(readable.dateAdded),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const isEditMode = id !== undefined;
  const theme = useAppTheme();
  const headerHeight = useHeaderHeight();

  // ── Load existing readable (edit mode) ──────────────────────────────────────
  // Always called — hooks must not be conditional.
  // In add mode, id = '' and the query returns null quickly.
  const {
    readable: existingReadable,
    isLoading: isLoadingExisting,
    isError: isExistingError,
    error: existingError,
  } = useReadable(id ?? '');

  // ── Form setup ──────────────────────────────────────────────────────────────
  const { control, handleSubmit, formState, watch, setValue, reset } =
    useForm<AddEditFormValues, unknown, AddEditFormOutput>({
      resolver: zodResolver(addEditSchema),
      defaultValues: getAddDefaultValues(),
    });

  // isFormReady gates the form render in edit mode until pre-fill is complete.
  // In add mode, the form is always ready immediately.
  const [isFormReady, setIsFormReady] = useState(!isEditMode);
  const hasResetRef = useRef(false);

  // Pre-fill form exactly once when the readable loads in edit mode.
  useEffect(() => {
    if (isEditMode && existingReadable && !hasResetRef.current) {
      hasResetRef.current = true;
      reset(getEditDefaultValues(existingReadable));
      setIsFormReady(true);
    }
  }, [isEditMode, existingReadable, reset]);

  // ── Watchers ─────────────────────────────────────────────────────────────────
  const watchedKind = watch('kind');
  const watchedProgressTotal = watch('progressTotal');
  const watchedIsComplete = watch('isComplete');
  const watchedSourceUrl = watch('sourceUrl');

  // ── Kind watcher — keep isComplete in sync (add mode only) ──────────────────
  // When kind changes to fanfic: default isComplete to false (WIP).
  // When kind changes to book: reset isComplete to null.
  // Also clear importContext when kind changes — a search done for book
  // should not carry over if the user switches to fanfic and vice versa.
  // shouldDirty: false so automated resets don't mark the form dirty.
  useEffect(() => {
    if (!isEditMode) {
      setValue('isComplete', watchedKind === 'fanfic' ? false : null, {
        shouldDirty: false,
      });
      setImportContext(null);
    }
  }, [watchedKind, isEditMode, setValue]);

  // ── Mutation hooks ───────────────────────────────────────────────────────────
  const { create, isPending: isCreating } = useCreateReadable();
  const { update, isPending: isUpdating } = useUpdateReadable();
  const isSaving = isCreating || isUpdating;

  // ── Metadata import hooks ────────────────────────────────────────────────────
  const { importMetadata, isImporting } = useImportMetadata();
  const { findAo3Duplicate } = useFindAo3Duplicate();

  // ── Import state ─────────────────────────────────────────────────────────────
  /** Separate search query for Google Books (not a form field). */
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  /**
   * Set after a successful import. Provides sourceType and sourceId to the
   * submit handler so the correct values are persisted. null = manual entry.
   */
  const [importContext, setImportContext] = useState<ImportContext | null>(null);

  // ── Snackbar ─────────────────────────────────────────────────────────────────
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  // ── Unsaved changes guard ────────────────────────────────────────────────────
  // savedRef: set to true after a successful save so the guard is bypassed
  // when navigation.goBack() triggers beforeRemove.
  const savedRef = useRef(false);
  // isDirtyRef: stable ref read inside the event listener (avoids stale closure).
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
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation]);

  // ── Focus refs ───────────────────────────────────────────────────────────────
  // Per §10: useRef<TextInput> from react-native (not Paper) for the type.
  // Paper's TextInput forwards its ref to the underlying native TextInput.
  const authorRef = useRef<RNTextInput>(null);
  const sourceUrlRef = useRef<RNTextInput>(null);
  const progressCurrentRef = useRef<RNTextInput>(null);
  const progressTotalRef = useRef<RNTextInput>(null);
  const summaryRef = useRef<RNTextInput>(null);
  const tagsRef = useRef<RNTextInput>(null);
  const dateAddedRef = useRef<RNTextInput>(null);

  // ── Import handlers ──────────────────────────────────────────────────────────

  /**
   * Applies a successful MetadataResult to the form and records the import context.
   * Only sets fields that are present in result.data (partial results are fine).
   * Shows a snackbar warning if any fields had extraction errors.
   */
  function applyImport(result: MetadataResult, kind: 'book' | 'fanfic') {
    const { data, errors } = result;

    if (data.title !== undefined) {
      setValue('title', data.title, { shouldDirty: true });
    }
    if (data.author !== undefined) {
      setValue('author', data.author ?? '', { shouldDirty: true });
    }
    if (data.summary !== undefined) {
      setValue('summary', data.summary ?? '', { shouldDirty: true });
    }
    if (data.tags !== undefined) {
      setValue('tags', data.tags.join(', '), { shouldDirty: true });
    }
    if (data.progressCurrent !== undefined) {
      setValue(
        'progressCurrent',
        data.progressCurrent != null ? String(data.progressCurrent) : '',
        { shouldDirty: true },
      );
    }
    if (data.progressTotal !== undefined) {
      setValue(
        'progressTotal',
        data.progressTotal != null ? String(data.progressTotal) : '',
        { shouldDirty: true },
      );
    }
    // isComplete is AO3-only — only set when kind is fanfic.
    if (kind === 'fanfic' && data.isComplete !== undefined) {
      setValue('isComplete', data.isComplete, { shouldDirty: true });
    }
    if (data.sourceUrl !== undefined) {
      setValue('sourceUrl', data.sourceUrl ?? '', { shouldDirty: true });
    }

    setImportContext({
      sourceType: kind === 'fanfic' ? 'ao3' : 'book_provider',
      sourceId: data.sourceId ?? null,
    });

    if (errors.length > 0) {
      setSnackbarMessage('Imported with warnings — some fields could not be extracted.');
    }
  }

  /**
   * Explicit user action: fetch metadata for the current kind and input.
   * Book: uses bookSearchQuery. Fanfic: uses the sourceUrl field value.
   * Performs AO3 duplicate detection before prefilling the form.
   */
  async function handleImport(kind: 'book' | 'fanfic') {
    const input = kind === 'fanfic' ? watchedSourceUrl.trim() : bookSearchQuery.trim();

    const result = await importMetadata(kind, input);

    // Total failure — no data extracted at all.
    if (Object.keys(result.data).length === 0) {
      setSnackbarMessage(result.errors[0] ?? 'Import failed. No data could be extracted.');
      return;
    }

    // AO3 duplicate detection (§6): check before prefilling.
    if (kind === 'fanfic' && result.data.sourceId) {
      let duplicate: Readable | null = null;
      try {
        duplicate = await findAo3Duplicate(result.data.sourceId);
      } catch {
        // Duplicate check failed — fail open and proceed with prefill.
      }

      if (duplicate) {
        Alert.alert(
          'Already in library',
          `"${duplicate.title}" is already in your library.`,
          [
            {
              text: 'Open existing',
              onPress: () => {
                // Bypass the unsaved-changes guard — user is intentionally navigating away.
                savedRef.current = true;
                navigation.navigate('ReadableDetail', { id: duplicate!.id });
              },
            },
            {
              text: 'Continue anyway',
              onPress: () => applyImport(result, kind),
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }
    }

    applyImport(result, kind);
  }

  // ── Submit handler ───────────────────────────────────────────────────────────
  // data is AddEditFormOutput (Zod-transformed: numbers for progress, null for empty strings).
  const onSubmit = handleSubmit((data: AddEditFormOutput) => {
    // Convert YYYY-MM-DD to full ISO (UTC midnight) for storage consistency.
    const isoDateAdded = new Date(data.dateAdded + 'T00:00:00.000Z').toISOString();

    if (!isEditMode) {
      const createInput: CreateReadableInput = {
        kind: data.kind,
        title: data.title,
        author: data.author,
        status: data.status,
        progressCurrent: data.progressCurrent,
        progressTotal: data.progressTotal,
        // Use import context when available; fall back to manual.
        sourceType: importContext?.sourceType ?? 'manual',
        sourceUrl: data.sourceUrl,
        sourceId: importContext?.sourceId ?? null,
        summary: data.summary,
        tags: data.tags,
        // isComplete is only meaningful for fanfic — always null for books.
        isComplete: data.kind === 'fanfic' ? data.isComplete : null,
        dateAdded: isoDateAdded,
      };
      create(createInput, {
        onSuccess: () => {
          savedRef.current = true;
          navigation.goBack();
        },
        onError: (err) => setSnackbarMessage(err.message),
      });
    } else if (existingReadable) {
      const updateInput: UpdateReadableInput = {
        title: data.title,
        author: data.author,
        status: data.status,
        progressCurrent: data.progressCurrent,
        progressTotal: data.progressTotal,
        sourceUrl: data.sourceUrl,
        summary: data.summary,
        tags: data.tags,
        // Enforce isComplete nullability for books using the immutable kind.
        isComplete: existingReadable.kind === 'fanfic' ? data.isComplete : null,
        dateAdded: isoDateAdded,
      };
      update(
        { id: existingReadable.id, input: updateInput, current: existingReadable },
        {
          onSuccess: () => {
            savedRef.current = true;
            navigation.goBack();
          },
          onError: (err) => setSnackbarMessage(err.message),
        },
      );
    }
  });

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isEditMode && isExistingError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary }}>
          {existingError?.message ?? 'Failed to load readable.'}
        </Text>
      </View>
    );
  }

  // Edit mode: show spinner while fetching + waiting for reset to complete.
  if (!isFormReady) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Edit mode: readable not found after successful fetch.
  if (isEditMode && !isLoadingExisting && !existingReadable) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary }}>Readable not found.</Text>
      </View>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const isFanfic = watchedKind === 'fanfic';
  const progressUnit = isFanfic ? 'chapters' : 'pages';
  // Hint shown below the Total field before submit when user has marked Complete
  // but not yet entered a total — guides them to fill it in.
  const showIsCompleteHint =
    isFanfic && watchedIsComplete === true && watchedProgressTotal.trim() === '';

  // AO3 import button: only enabled when sourceUrl looks like an AO3 works URL.
  const canImportFromAo3 =
    !isEditMode &&
    isFanfic &&
    watchedSourceUrl.trim().startsWith('https://archiveofourown.org/works/');

  // Book search button: only enabled when the search query is non-empty.
  const canSearchBooks = !isEditMode && !isFanfic && bookSearchQuery.trim().length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Kind selector (add mode only) ────────────────────────────────── */}
        {!isEditMode && (
          <View style={styles.section}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
            >
              Kind *
            </Text>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={[
                    { value: 'book', label: 'Book' },
                    { value: 'fanfic', label: 'Fanfic' },
                  ]}
                />
              )}
            />
          </View>
        )}

        {/* ── Book import section (add mode, kind = book only) ─────────────── */}
        {!isEditMode && !isFanfic && (
          <View style={[styles.section, styles.importSection, { borderColor: theme.colors.border }]}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
            >
              Search Google Books
            </Text>
            <View style={styles.importRow}>
              <TextInput
                label="Title, author, or ISBN"
                value={bookSearchQuery}
                onChangeText={setBookSearchQuery}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (canSearchBooks) void handleImport('book');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.importInput]}
                mode="outlined"
                accessibilityLabel="Search query for Google Books"
              />
              <Button
                mode="outlined"
                onPress={() => void handleImport('book')}
                loading={isImporting}
                disabled={isImporting || !canSearchBooks}
                style={styles.importButton}
                accessibilityLabel="Search Google Books"
              >
                Search
              </Button>
            </View>
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
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
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
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
              )}
            </View>
          )}
        />

        {/* ── Status ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelLarge"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            Status *
          </Text>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedButtons
                value={field.value}
                onValueChange={field.onChange}
                buttons={READABLE_STATUSES.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                }))}
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
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
              )}
            </View>
          )}
        />

        {/* ── AO3 import button (add mode, kind = fanfic only) ─────────────── */}
        {!isEditMode && isFanfic && (
          <Button
            mode="outlined"
            onPress={() => void handleImport('fanfic')}
            loading={isImporting}
            disabled={isImporting || !canImportFromAo3}
            style={styles.ao3ImportButton}
            accessibilityLabel="Import metadata from AO3"
          >
            Import from AO3
          </Button>
        )}

        {/* ── Progress ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="labelLarge"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
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
                    onSubmitEditing={() => progressTotalRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
                    accessibilityLabel={`Current ${progressUnit}`}
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>
                      {fieldState.error.message}
                    </HelperText>
                  )}
                </View>
              )}
            />
            <Controller
              control={control}
              name="progressTotal"
              render={({ field, fieldState }) => (
                <View style={styles.progressField}>
                  <TextInput
                    ref={progressTotalRef}
                    label="Total"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => summaryRef.current?.focus()}
                    style={styles.input}
                    mode="outlined"
                    accessibilityLabel={`Total ${progressUnit}`}
                  />
                  {fieldState.error && (
                    <HelperText type="error" visible>
                      {fieldState.error.message}
                    </HelperText>
                  )}
                  {!fieldState.error && showIsCompleteHint && (
                    <HelperText type="info" visible>
                      Set total chapters to mark as complete
                    </HelperText>
                  )}
                </View>
              )}
            />
          </View>
        </View>

        {/* ── isComplete toggle (fanfic only) ────────────────────────────────── */}
        {isFanfic && (
          <View style={styles.section}>
            <Text
              variant="labelLarge"
              style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
            >
              Completion status
            </Text>
            <Controller
              control={control}
              name="isComplete"
              render={({ field }) => (
                <View style={styles.switchRow}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.textPrimary }}
                  >
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
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
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
                onSubmitEditing={() => dateAddedRef.current?.focus()}
                style={styles.input}
                mode="outlined"
                accessibilityLabel="Tags, comma separated"
              />
              {fieldState.error && (
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
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
                <HelperText type="error" visible>
                  {fieldState.error.message}
                </HelperText>
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

      {/* ── Snackbar for mutation and import errors/warnings ─────────────────── */}
      <Portal>
        <Snackbar
          visible={snackbarMessage !== null}
          onDismiss={() => setSnackbarMessage(null)}
          duration={4000}
        >
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </KeyboardAvoidingView>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  fieldWrapper: {
    marginBottom: 4,
  },
  input: {
    // Paper TextInput handles internal padding
  },
  progressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  progressField: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  submitButton: {
    marginTop: 16,
  },
  importSection: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  importInput: {
    flex: 1,
  },
  importButton: {
    alignSelf: 'center',
    marginTop: 4,
  },
  ao3ImportButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
});
