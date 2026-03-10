// src/features/readables/ui/AddEditScreen.tsx
// §10 — Add/edit screen for books and fanfics.
//
// Modes:
//   Add: id absent from route params. kind selector visible. sourceType = 'manual'
//        unless the user imports metadata (then 'ao3' or 'book_provider').
//   Edit: id present. kind hidden and immutable. Form pre-filled from repository.
//         No import functionality in edit mode.
//
// Book import flow (add mode):
//   Search → edition picker modal (up to 5 results, each with cover thumbnail,
//   all contributors, subtitle, edition info, ISBN) → user selects → form prefilled.
//   isbn, coverUrl, and availableChapters are stored in importContext and passed
//   to createReadable (not form fields — import-only values).

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
  Divider,
  HelperText,
  Modal,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
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
import type { BookSearchResult, MetadataResult } from '../../metadata';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditReadable'>;

/**
 * Tracks which provider was used so the submit handler writes the correct
 * sourceType/sourceId. Also carries import-only fields (isbn, coverUrl,
 * availableChapters) so they can be persisted without being form fields.
 */
interface ImportContext {
  sourceType: 'ao3' | 'book_provider';
  sourceId: string | null;
  isbn: string | null;
  coverUrl: string | null;
  availableChapters: number | null;
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_LABELS: Record<ReadableStatus, string> = {
  want_to_read: 'Want',
  reading: 'Reading',
  completed: 'Done',
  dnf: 'DNF',
};

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
    progressCurrent: readable.progressCurrent != null ? String(readable.progressCurrent) : '',
    progressTotal: readable.progressTotal != null ? String(readable.progressTotal) : '',
    sourceUrl: readable.sourceUrl ?? '',
    summary: readable.summary ?? '',
    tags: readable.tags.join(', '),
    isComplete: readable.isComplete,
    dateAdded: isoToLocalDate(readable.dateAdded),
  };
}

export function AddEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const isEditMode = id !== undefined;
  const theme = useAppTheme();
  const headerHeight = useHeaderHeight();

  const {
    readable: existingReadable,
    isLoading: isLoadingExisting,
    isError: isExistingError,
    error: existingError,
    refetch: refetchExisting,
  } = useReadable(id ?? '');

  const { control, handleSubmit, formState, watch, setValue, reset } =
    useForm<AddEditFormValues, unknown, AddEditFormOutput>({
      resolver: zodResolver(addEditSchema),
      defaultValues: getAddDefaultValues(),
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

  const watchedKind = watch('kind');
  const watchedProgressTotal = watch('progressTotal');
  const watchedIsComplete = watch('isComplete');
  const watchedSourceUrl = watch('sourceUrl');

  useEffect(() => {
    if (!isEditMode) {
      setValue('isComplete', watchedKind === 'fanfic' ? false : null, { shouldDirty: false });
      setImportContext(null);
      clearBookResults();
    }
    // clearBookResults is stable (useCallback in the hook).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKind, isEditMode, setValue]);

  const { create, isPending: isCreating } = useCreateReadable();
  const { update, isPending: isUpdating } = useUpdateReadable();
  const isSaving = isCreating || isUpdating;

  const { importMetadata, searchBooks, bookSearchResults, clearBookResults, isImporting } =
    useImportMetadata();
  const { findAo3Duplicate } = useFindAo3Duplicate();

  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [importContext, setImportContext] = useState<ImportContext | null>(null);

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

  const authorRef = useRef<RNTextInput>(null);
  const sourceUrlRef = useRef<RNTextInput>(null);
  const progressCurrentRef = useRef<RNTextInput>(null);
  const progressTotalRef = useRef<RNTextInput>(null);
  const summaryRef = useRef<RNTextInput>(null);
  const tagsRef = useRef<RNTextInput>(null);
  const dateAddedRef = useRef<RNTextInput>(null);

  function applyImport(result: MetadataResult, kind: 'book' | 'fanfic') {
    const { data, errors } = result;

    if (data.title !== undefined) setValue('title', data.title, { shouldDirty: true });
    if (data.author !== undefined) setValue('author', data.author ?? '', { shouldDirty: true });
    if (data.summary !== undefined) setValue('summary', data.summary ?? '', { shouldDirty: true });
    if (data.tags !== undefined) setValue('tags', data.tags.join(', '), { shouldDirty: true });
    if (data.progressCurrent !== undefined) {
      setValue('progressCurrent', data.progressCurrent != null ? String(data.progressCurrent) : '', { shouldDirty: true });
    }
    if (data.progressTotal !== undefined) {
      setValue('progressTotal', data.progressTotal != null ? String(data.progressTotal) : '', { shouldDirty: true });
    }
    if (kind === 'fanfic' && data.isComplete !== undefined) {
      setValue('isComplete', data.isComplete, { shouldDirty: true });
    }
    if (data.sourceUrl !== undefined) setValue('sourceUrl', data.sourceUrl ?? '', { shouldDirty: true });

    setImportContext({
      sourceType: kind === 'fanfic' ? 'ao3' : 'book_provider',
      sourceId: data.sourceId ?? null,
      isbn: data.isbn ?? null,
      coverUrl: data.coverUrl ?? null,
      availableChapters: data.availableChapters ?? null,
    });

    if (errors.length > 0) {
      showSnackbar('Imported with warnings — some fields could not be extracted.');
    }
  }

  function handleSelectBookResult(result: BookSearchResult) {
    clearBookResults();
    applyImport({ data: result.metadata, errors: [] }, 'book');
  }

  async function handleImport(kind: 'book' | 'fanfic') {
    if (kind === 'book') {
      const { results, errors } = await searchBooks(bookSearchQuery.trim());
      if (results.length === 0) {
        showSnackbar(errors[0] ?? 'No results found on Google Books.');
      }
      return;
    }

    const input = watchedSourceUrl.trim();
    const result = await importMetadata('fanfic', input);

    if (Object.keys(result.data).length === 0) {
      showSnackbar(result.errors[0] ?? 'Import failed. No data could be extracted.');
      return;
    }

    if (result.data.sourceId) {
      let duplicate: Readable | null = null;
      try {
        duplicate = await findAo3Duplicate(result.data.sourceId);
      } catch {
        // Fail open — proceed with prefill.
      }

      if (duplicate) {
        Alert.alert(
          'Already in library',
          `"${duplicate.title}" is already in your library.`,
          [
            {
              text: 'Open existing',
              onPress: () => {
                savedRef.current = true;
                navigation.navigate('ReadableDetail', { id: duplicate!.id });
              },
            },
            { text: 'Continue anyway', onPress: () => applyImport(result, kind) },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }
    }

    applyImport(result, kind);
  }

  const onSubmit = handleSubmit((data: AddEditFormOutput) => {
    const isoDateAdded = new Date(data.dateAdded + 'T00:00:00.000Z').toISOString();

    if (!isEditMode) {
      const createInput: CreateReadableInput = {
        kind: data.kind,
        title: data.title,
        author: data.author,
        status: data.status,
        progressCurrent: data.progressCurrent,
        progressTotal: data.progressTotal,
        sourceType: importContext?.sourceType ?? 'manual',
        sourceUrl: data.sourceUrl,
        sourceId: importContext?.sourceId ?? null,
        summary: data.summary,
        tags: data.tags,
        isComplete: data.kind === 'fanfic' ? data.isComplete : null,
        dateAdded: isoDateAdded,
        isbn: importContext?.isbn ?? null,
        coverUrl: importContext?.coverUrl ?? null,
        availableChapters: importContext?.availableChapters ?? null,
      };
      create(createInput, {
        onSuccess: () => { savedRef.current = true; navigation.goBack(); },
        onError: (err) => showSnackbar(err.message),
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
        isComplete: existingReadable.kind === 'fanfic' ? data.isComplete : null,
        dateAdded: isoDateAdded,
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

  if (!isFormReady) {
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
  const showIsCompleteHint = isFanfic && watchedIsComplete === true && watchedProgressTotal.trim() === '';
  const canImportFromAo3 = !isEditMode && isFanfic && watchedSourceUrl.trim().startsWith('https://archiveofourown.org/works/');
  const canSearchBooks = !isEditMode && !isFanfic && bookSearchQuery.trim().length > 0;
  const showEditionPicker = bookSearchResults !== null && bookSearchResults.length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Kind selector (add mode only) ────────────────────────────────── */}
        {!isEditMode && (
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

        {/* ── Book import section (add mode, kind = book only) ─────────────── */}
        {!isEditMode && !isFanfic && (
          <View style={[styles.section, styles.importSection, { borderColor: theme.colors.outline }]}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Search Google Books
            </Text>
            <View style={styles.importRow}>
              <TextInput
                label="Title, author, or ISBN"
                value={bookSearchQuery}
                onChangeText={setBookSearchQuery}
                returnKeyType="search"
                onSubmitEditing={() => { if (canSearchBooks) void handleImport('book'); }}
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
              <TextInput label="Title *" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} returnKeyType="next" onSubmitEditing={() => authorRef.current?.focus()} style={styles.input} mode="outlined" accessibilityLabel="Title, required" />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
            </View>
          )}
        />

        {/* ── Author ─────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="author"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput ref={authorRef} label="Author" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} returnKeyType="next" onSubmitEditing={() => sourceUrlRef.current?.focus()} style={styles.input} mode="outlined" accessibilityLabel="Author" />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
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
                buttons={READABLE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
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
              <TextInput ref={sourceUrlRef} label={isFanfic ? 'AO3 Work URL' : 'Source URL'} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} returnKeyType="next" onSubmitEditing={() => progressCurrentRef.current?.focus()} keyboardType="url" autoCapitalize="none" autoCorrect={false} style={styles.input} mode="outlined" accessibilityLabel={isFanfic ? 'AO3 work URL' : 'Source URL'} />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
            </View>
          )}
        />

        {/* ── AO3 import button (add mode, kind = fanfic only) ─────────────── */}
        {!isEditMode && isFanfic && (
          <Button mode="outlined" onPress={() => void handleImport('fanfic')} loading={isImporting} disabled={isImporting || !canImportFromAo3} style={styles.ao3ImportButton} accessibilityLabel="Import metadata from AO3">
            Import from AO3
          </Button>
        )}

        {/* ── Progress ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Progress ({progressUnit})</Text>
          <View style={styles.progressRow}>
            <Controller
              control={control}
              name="progressCurrent"
              render={({ field, fieldState }) => (
                <View style={styles.progressField}>
                  <TextInput ref={progressCurrentRef} label="Current" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} keyboardType="number-pad" returnKeyType="next" onSubmitEditing={() => progressTotalRef.current?.focus()} style={styles.input} mode="outlined" accessibilityLabel={`Current ${progressUnit}`} />
                  {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
                </View>
              )}
            />
            <Controller
              control={control}
              name="progressTotal"
              render={({ field, fieldState }) => (
                <View style={styles.progressField}>
                  <TextInput ref={progressTotalRef} label="Total" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} keyboardType="number-pad" returnKeyType="next" onSubmitEditing={() => summaryRef.current?.focus()} style={styles.input} mode="outlined" accessibilityLabel={`Total ${progressUnit}`} />
                  {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
                  {!fieldState.error && showIsCompleteHint && <HelperText type="info" visible>Set total chapters to mark as complete</HelperText>}
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
                  <Switch value={field.value === true} onValueChange={(v) => field.onChange(v)} accessibilityLabel="Mark as complete" />
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
              <TextInput ref={summaryRef} label="Summary" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} multiline numberOfLines={4} style={styles.input} mode="outlined" accessibilityLabel="Summary" />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
            </View>
          )}
        />

        {/* ── Tags ─────────────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="tags"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput ref={tagsRef} label="Tags (comma-separated)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} returnKeyType="next" onSubmitEditing={() => dateAddedRef.current?.focus()} style={styles.input} mode="outlined" accessibilityLabel="Tags, comma separated" />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
            </View>
          )}
        />

        {/* ── Date Added ───────────────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="dateAdded"
          render={({ field, fieldState }) => (
            <View style={styles.fieldWrapper}>
              <TextInput ref={dateAddedRef} label="Date Added (YYYY-MM-DD)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={!!fieldState.error} returnKeyType="done" style={styles.input} mode="outlined" accessibilityLabel="Date added in format YYYY-MM-DD" />
              {fieldState.error && <HelperText type="error" visible>{fieldState.error.message}</HelperText>}
            </View>
          )}
        />

        {/* ── Submit button ─────────────────────────────────────────────────────── */}
        <Button mode="contained" onPress={onSubmit} loading={isSaving} disabled={isSaving} style={styles.submitButton} accessibilityLabel={isEditMode ? 'Save changes' : 'Add to library'}>
          {isEditMode ? 'Save Changes' : 'Add to Library'}
        </Button>

      </ScrollView>

      {/* ── Edition picker modal ──────────────────────────────────────────────── */}
      <Portal>
        <Modal
          visible={showEditionPicker}
          onDismiss={clearBookResults}
          contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleMedium" style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
            Select Edition
          </Text>
          <ScrollView>
            {(bookSearchResults ?? []).map((result, index) => (
              <React.Fragment key={index}>
                <TouchableRipple
                  onPress={() => handleSelectBookResult(result)}
                  accessibilityLabel={`Select ${result.displayTitle}`}
                  accessibilityRole="button"
                >
                  <View style={styles.editionItem}>
                    {result.coverUrl !== null && (
                      <Image
                        source={{ uri: result.coverUrl }}
                        style={[styles.editionCover, { backgroundColor: theme.colors.surfaceVariant }]}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.editionDetails}>
                      <Text variant="bodyLarge" style={{ color: theme.colors.textPrimary }} numberOfLines={2}>
                        {result.displayTitle}
                      </Text>
                      {result.subtitle !== null && (
                        <Text variant="bodySmall" style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
                          {result.subtitle}
                        </Text>
                      )}
                      {result.allContributors.length > 0 && (
                        <Text variant="bodySmall" style={{ color: theme.colors.textSecondary }} numberOfLines={2}>
                          {result.allContributors.join(', ')}
                        </Text>
                      )}
                      {result.displayInfo !== '' && (
                        <Text variant="bodySmall" style={{ color: theme.colors.textDisabled }} numberOfLines={1}>
                          {result.displayInfo}
                        </Text>
                      )}
                      {result.isbn !== null && (
                        <Text variant="bodySmall" style={{ color: theme.colors.textDisabled }} numberOfLines={1}>
                          ISBN: {result.isbn}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableRipple>
                {index < (bookSearchResults ?? []).length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </ScrollView>
          <Button mode="text" onPress={clearBookResults} style={styles.modalCancelButton} accessibilityLabel="Cancel edition selection">
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* ── Snackbar ─────────────────────────────────────────────────────────── */}
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
  submitButton: { marginTop: 16 },
  importSection: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  importRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  importInput: { flex: 1 },
  importButton: { alignSelf: 'center', marginTop: 4 },
  ao3ImportButton: { marginBottom: 12, alignSelf: 'flex-start' },
  modalContainer: { margin: 24, borderRadius: 12, padding: 16, maxHeight: '80%' },
  modalTitle: { marginBottom: 12 },
  editionItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 4, gap: 12 },
  editionCover: { width: 40, height: 53, borderRadius: 3, flexShrink: 0 },
  editionDetails: { flex: 1, gap: 2 },
  modalCancelButton: { marginTop: 8, alignSelf: 'flex-end' },
});
