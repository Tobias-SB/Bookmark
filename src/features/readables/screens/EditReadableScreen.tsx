// src/features/readables/screens/EditReadableScreen.tsx
import React, { useEffect, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';

import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, SegmentedButtons, Text, TextInput, HelperText } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ReadableMetadataForm from '@src/features/readables/components/ReadableMetadataForm';
import MoodTagSelector from '@src/features/moods/components/MoodTagSelector';

import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import type {
  BookSource,
  ReadableItem,
  BookReadable,
  FanficReadable,
  Ao3Rating,
  ReadableStatus,
  ProgressMode,
} from '../types';
import { readableRepository } from '../services/readableRepository';
import { ALL_MOOD_TAGS, MoodTag } from '@src/features/moods/types';
import { extractAo3WorkIdFromUrl } from '@src/utils/text';
import { useAppThemeMode } from '@src/theme';
import TimeHmsFields, {
  hmsPartsToSeconds,
  secondsToHmsParts,
  type TimeHmsValue,
} from '../components/TimeHmsFields';

type EditRoute = RouteProp<RootStackParamList, 'EditReadable'>;
type RootNav = NavigationProp<RootStackParamList>;

type EditProgressMode = 'units' | 'time';

interface EditReadableFormValues {
  type: 'book' | 'fanfic';
  title: string;
  author: string;
  description?: string;
  priority: string;
  source: BookSource | 'ao3';
  pageCount?: string;
  wordCount?: string;
  ao3Url?: string;
  moodTags: MoodTag[];

  // Fanfic extras
  chapterCount?: string;
  complete: boolean;
  rating?: Ao3Rating | null;

  // Progress settings (EDIT SCREEN ONLY: units/time)
  progressMode: EditProgressMode;

  // Fanfic chapter totals (units mode)
  availableChapters: string; // numeric or ''
  totalChapters: string; // numeric or ''

  // Total time (time mode)
  timeTotalHms: TimeHmsValue;

  // Manual date fields
  startedAt?: string | null;
  finishedAt?: string | null;
  dnfAt?: string | null;
}

function formatDateForField(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dateFieldSchema = yup
  .string()
  .nullable()
  .transform((v) => (v === '' ? null : v))
  .test('is-valid-date', 'Use YYYY-MM-DD (e.g. 2025-03-15)', (value) => {
    if (!value) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  });

function parseOptionalInt(input: string | undefined): number | null {
  const raw = (input ?? '').trim();
  if (raw === '') return null;
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

const schema = yup
  .object({
    type: yup.mixed<'book' | 'fanfic'>().oneOf(['book', 'fanfic']).required(),
    title: yup.string().required('Title is required'),
    author: yup.string().required('Author is required'),
    description: yup.string().optional(),
    priority: yup
      .string()
      .matches(/^[1-5]$/, 'Priority must be between 1 and 5')
      .required('Priority is required'),
    source: yup
      .mixed<BookSource | 'ao3'>()
      .oneOf(['manual', 'googleBooks', 'openLibrary', 'goodreads', 'ao3'])
      .required(),
    pageCount: yup
      .string()
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .optional(),
    wordCount: yup
      .string()
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .optional(),
    ao3Url: yup
      .string()
      .url('Must be a valid URL')
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .optional(),
    moodTags: yup.array(yup.mixed<MoodTag>().oneOf(ALL_MOOD_TAGS as MoodTag[])).required(),

    chapterCount: yup
      .string()
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .optional(),
    complete: yup.boolean().required(),
    rating: yup
      .mixed<Ao3Rating>()
      .oneOf(['G', 'T', 'M', 'E', 'NR'] as const)
      .nullable()
      .optional(),

    // ✅ EDIT SCREEN ONLY: units/time
    progressMode: yup.mixed<EditProgressMode>().oneOf(['units', 'time']).required(),

    // ✅ Only required/validated when editing a fanfic in units mode
    availableChapters: yup.string().when(['type', 'progressMode'], {
      is: (t: EditReadableFormValues['type'], m: EditProgressMode) =>
        t === 'fanfic' && m === 'units',
      then: (s) =>
        s
          .required('Available chapters is required')
          .test(
            'is-non-negative-int',
            'Must be a non-negative number',
            (v) => parseOptionalInt(v ?? '') != null,
          ),
      otherwise: (s) => s.optional(),
    }),
    totalChapters: yup.string().when(['type', 'progressMode'], {
      is: (t: EditReadableFormValues['type'], m: EditProgressMode) =>
        t === 'fanfic' && m === 'units',
      then: (s) =>
        s.optional().test('is-empty-or-int', 'Must be a non-negative number', (v) => {
          const raw = (v ?? '').trim();
          if (raw === '') return true; // allow '?' by leaving blank
          return parseOptionalInt(raw) != null;
        }),
      otherwise: (s) => s.optional(),
    }),

    // We keep this present always; empty parts are allowed and mean "unset".
    timeTotalHms: yup
      .object({
        hh: yup.string().required(),
        mm: yup.string().required(),
        ss: yup.string().required(),
      })
      .required(),

    startedAt: dateFieldSchema.optional(),
    finishedAt: dateFieldSchema.optional(),
    dnfAt: dateFieldSchema.optional(),
  })
  .required() as yup.ObjectSchema<EditReadableFormValues>;

interface DatePickerFieldProps {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  errorMessage?: string;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  errorMessage,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const { mode } = useAppThemeMode();
  const isDark = mode === 'dark';

  const today = new Date();

  let initialDate = today;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      initialDate = parsed > today ? today : parsed;
    }
  }

  const handleOpen = () => setShowPicker(true);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && date) {
      const clamped = date > today ? today : date;
      onChange(formatDateForField(clamped));
    }
  };

  return (
    <View style={styles.dateField}>
      <Pressable onPress={handleOpen}>
        <View pointerEvents="none">
          <TextInput
            label={label}
            mode="outlined"
            value={value ?? ''}
            editable={false}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>
      </Pressable>

      {errorMessage && (
        <HelperText type="error" visible>
          {errorMessage}
        </HelperText>
      )}

      {showPicker && (
        <DateTimePicker
          mode="date"
          value={initialDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={today}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}
    </View>
  );
};

const EditReadableScreen: React.FC = () => {
  const route = useRoute<EditRoute>();
  const navigation = useNavigation<RootNav>();
  const queryClient = useQueryClient();

  const id = route.params?.id;
  const draft = route.params?.draft as Partial<ReadableItem> | undefined;
  const isEditing = !!id;

  const { data, isLoading } = useReadableById(id);

  const { control, handleSubmit, reset, watch, setValue } = useForm<EditReadableFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      type: draft?.type ?? 'book',
      title: draft?.title ?? '',
      author: draft?.author ?? '',
      description: (draft?.description as string | undefined) ?? '',
      priority: draft?.priority != null ? String(draft.priority) : '3',
      source: draft?.type === 'fanfic' ? 'ao3' : 'manual',
      pageCount: '',
      wordCount:
        draft && draft.type === 'fanfic' && (draft as Partial<FanficReadable>).wordCount != null
          ? String((draft as Partial<FanficReadable>).wordCount)
          : '',
      ao3Url:
        draft && draft.type === 'fanfic' ? ((draft as Partial<FanficReadable>).ao3Url ?? '') : '',
      moodTags: draft?.moodTags ?? [],
      chapterCount: '',
      complete:
        draft && draft.type === 'fanfic' && (draft as Partial<FanficReadable>).complete != null
          ? Boolean((draft as Partial<FanficReadable>).complete)
          : false,
      rating:
        draft && draft.type === 'fanfic'
          ? ((draft as Partial<FanficReadable>).rating ?? null)
          : null,
      progressMode: draft?.progressMode === 'time' ? 'time' : 'units',
      availableChapters: '',
      totalChapters: '',
      timeTotalHms: secondsToHmsParts(draft?.timeTotalSeconds ?? null),
      startedAt: draft?.startedAt ? draft.startedAt.slice(0, 10) : '',
      finishedAt: draft?.finishedAt ? draft.finishedAt.slice(0, 10) : '',
      dnfAt: draft?.dnfAt ? draft.dnfAt.slice(0, 10) : '',
    },
  });

  const currentType = watch('type');
  const selectedMoodTags = watch('moodTags');
  const currentRating = watch('rating');
  const completeValue = watch('complete');
  const progressMode = watch('progressMode');
  const timeTotalHms = watch('timeTotalHms');

  const [genresList, setGenresList] = useState<string[]>([]);
  const [fandomsList, setFandomsList] = useState<string[]>([]);
  const [relationshipsList, setRelationshipsList] = useState<string[]>([]);
  const [charactersList, setCharactersList] = useState<string[]>([]);
  const [ao3TagsList, setAo3TagsList] = useState<string[]>([]);
  const [warningsList, setWarningsList] = useState<string[]>([]);

  useEffect(() => {
    if (data && isEditing) {
      const readable = data;

      const baseDefaults: Partial<EditReadableFormValues> = {
        type: readable.type,
        title: readable.title,
        author: readable.author,
        description: readable.description ?? '',
        priority: String(readable.priority),
        moodTags: readable.moodTags,
        progressMode: readable.progressMode === 'time' ? 'time' : 'units',
        timeTotalHms: secondsToHmsParts(readable.timeTotalSeconds ?? null),
        startedAt: readable.startedAt ? readable.startedAt.slice(0, 10) : '',
        finishedAt: readable.finishedAt ? readable.finishedAt.slice(0, 10) : '',
        dnfAt: readable.dnfAt ? readable.dnfAt.slice(0, 10) : '',
      };

      if (readable.type === 'book') {
        reset({
          ...baseDefaults,
          source: readable.source,
          pageCount: readable.pageCount ? String(readable.pageCount) : '',
          wordCount: '',
          ao3Url: '',
          chapterCount: '',
          complete: false,
          rating: null,
          availableChapters: '',
          totalChapters: '',
        } as EditReadableFormValues);

        setGenresList(readable.genres ?? []);
        setFandomsList([]);
        setRelationshipsList([]);
        setCharactersList([]);
        setAo3TagsList([]);
        setWarningsList([]);
      } else {
        reset({
          ...baseDefaults,
          source: 'ao3',
          pageCount: '',
          wordCount: readable.wordCount ? String(readable.wordCount) : '',
          ao3Url: readable.ao3Url,
          chapterCount: readable.chapterCount ? String(readable.chapterCount) : '',
          complete: readable.complete ?? false,
          rating: readable.rating ?? null,
          availableChapters:
            readable.availableChapters != null ? String(readable.availableChapters) : '',
          totalChapters: readable.totalChapters != null ? String(readable.totalChapters) : '',
        } as EditReadableFormValues);

        setGenresList([]);
        setFandomsList(readable.fandoms ?? []);
        setRelationshipsList(readable.relationships ?? []);
        setCharactersList(readable.characters ?? []);
        setAo3TagsList(readable.ao3Tags ?? []);
        setWarningsList(readable.warnings ?? []);
      }
    }
  }, [data, isEditing, reset]);

  useEffect(() => {
    if (!isEditing && draft) {
      const baseDefaults: Partial<EditReadableFormValues> = {
        type: draft.type ?? 'book',
        title: draft.title ?? '',
        author: draft.author ?? '',
        description: (draft.description as string | undefined) ?? '',
        priority: draft.priority != null ? String(draft.priority) : '3',
        moodTags: draft.moodTags ?? [],
        progressMode: draft.progressMode === 'time' ? 'time' : 'units',
        timeTotalHms: secondsToHmsParts(draft.timeTotalSeconds ?? null),
        startedAt: draft.startedAt ? draft.startedAt.slice(0, 10) : '',
        finishedAt: draft.finishedAt ? draft.finishedAt.slice(0, 10) : '',
        dnfAt: draft.dnfAt ? draft.dnfAt.slice(0, 10) : '',
      };

      if (draft.type === 'fanfic') {
        const fanficDraft = draft as Partial<FanficReadable>;
        reset({
          ...baseDefaults,
          source: 'ao3',
          pageCount: '',
          wordCount: fanficDraft.wordCount != null ? String(fanficDraft.wordCount) : '',
          ao3Url: fanficDraft.ao3Url ?? '',
          chapterCount: fanficDraft.chapterCount != null ? String(fanficDraft.chapterCount) : '',
          complete: fanficDraft.complete ?? false,
          rating: fanficDraft.rating ?? null,
          availableChapters:
            fanficDraft.availableChapters != null ? String(fanficDraft.availableChapters) : '',
          totalChapters: fanficDraft.totalChapters != null ? String(fanficDraft.totalChapters) : '',
        } as EditReadableFormValues);

        setGenresList([]);
        setFandomsList(fanficDraft.fandoms ?? []);
        setRelationshipsList(fanficDraft.relationships ?? []);
        setCharactersList(fanficDraft.characters ?? []);
        setAo3TagsList(fanficDraft.ao3Tags ?? []);
        setWarningsList(fanficDraft.warnings ?? []);
      } else {
        const bookDraft = draft as Partial<BookReadable>;
        reset({
          ...baseDefaults,
          source: 'manual',
          pageCount: bookDraft.pageCount != null ? String(bookDraft.pageCount) : '',
          wordCount: '',
          ao3Url: '',
          chapterCount: '',
          complete: false,
          rating: null,
          availableChapters: '',
          totalChapters: '',
        } as EditReadableFormValues);

        setGenresList(bookDraft.genres ?? []);
        setFandomsList([]);
        setRelationshipsList([]);
        setCharactersList([]);
        setAo3TagsList([]);
        setWarningsList([]);
      }
    }
  }, [draft, isEditing, reset]);

  if (isEditing && isLoading && !data) {
    return (
      <Screen>
        <LoadingState message="Loading readable…" />
      </Screen>
    );
  }

  const normaliseDate = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const onSubmit = async (values: EditReadableFormValues) => {
    try {
      const priorityNumber = parseInt(values.priority, 10);

      const pageCountNumber =
        values.pageCount != null ? parseInt(values.pageCount, 10) || undefined : undefined;
      const wordCountNumber =
        values.wordCount != null ? parseInt(values.wordCount, 10) || undefined : undefined;
      const chapterCountNumber =
        values.chapterCount != null ? parseInt(values.chapterCount, 10) || undefined : undefined;

      const startedAt = normaliseDate(values.startedAt);
      const finishedAt = normaliseDate(values.finishedAt);
      const dnfAt = normaliseDate(values.dnfAt);

      // Edit screen: total time is ALWAYS editable here.
      const totalSeconds = hmsPartsToSeconds(values.timeTotalHms);
      const timeTotalSeconds = totalSeconds != null && totalSeconds > 0 ? totalSeconds : null;

      const availableChapters = parseOptionalInt(values.availableChapters);
      const totalChapters = parseOptionalInt(values.totalChapters);

      let result: ReadableItem;

      if (isEditing && data) {
        const existing = data;

        if (existing.type === 'book') {
          const updatedBook: BookReadable = {
            ...(existing as ReadableItem),
            type: 'book',
            title: values.title,
            author: values.author,
            description: values.description,
            priority: priorityNumber,
            status: existing.status,
            moodTags: values.moodTags,
            source: existing.source,
            sourceId: existing.sourceId ?? null,
            pageCount: pageCountNumber ?? null,
            currentPage: existing.currentPage ?? null,
            genres: genresList,
            progressMode: values.progressMode as ProgressMode, // stored type still allows percent, but we never set it here
            progressPercent: existing.progressPercent,
            timeTotalSeconds,
            startedAt,
            finishedAt,
            dnfAt,
          };

          result = await readableRepository.update(updatedBook);
          await readableRepository.setTimeTotalSeconds(result.id, timeTotalSeconds);
        } else {
          const ao3Url = values.ao3Url ?? '';
          const ao3WorkId =
            extractAo3WorkIdFromUrl(ao3Url) ??
            (existing.type === 'fanfic' ? existing.ao3WorkId : 'unknown');

          const updatedFanfic: FanficReadable = {
            ...(existing as ReadableItem),
            type: 'fanfic',
            title: values.title,
            author: values.author,
            description: values.description,
            priority: priorityNumber,
            status: existing.status,
            moodTags: values.moodTags,
            source: 'ao3',
            ao3Url,
            ao3WorkId,
            fandoms: fandomsList,
            relationships: relationshipsList,
            characters: charactersList,
            ao3Tags: ao3TagsList,
            rating: values.rating ?? null,
            warnings: warningsList,

            // Keep legacy chapterCount, but align it with totalChapters when provided.
            chapterCount: chapterCountNumber ?? totalChapters ?? existing.chapterCount ?? null,

            availableChapters:
              values.progressMode === 'units'
                ? availableChapters
                : (existing.availableChapters ?? null),
            totalChapters:
              values.progressMode === 'units' ? totalChapters : (existing.totalChapters ?? null),

            currentChapter: existing.currentChapter ?? null,
            complete: values.complete ?? false,
            wordCount: wordCountNumber ?? null,

            progressMode: values.progressMode as ProgressMode,
            progressPercent: existing.progressPercent,
            timeTotalSeconds,
            startedAt,
            finishedAt,
            dnfAt,
          };

          result = await readableRepository.update(updatedFanfic);
          await readableRepository.setTimeTotalSeconds(result.id, timeTotalSeconds);
        }
      } else {
        if (values.type === 'book') {
          const newBook: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'book',
            title: values.title,
            author: values.author,
            description: values.description,
            status: 'to-read',
            priority: priorityNumber,
            progressPercent: 0,
            progressMode: values.progressMode as ProgressMode,
            moodTags: values.moodTags,
            source: 'manual',
            sourceId: null,
            pageCount: pageCountNumber ?? null,
            currentPage: null,
            genres: genresList,
            timeCurrentSeconds: null,
            timeTotalSeconds,
            startedAt,
            finishedAt,
            dnfAt,
            notes: null,
          };

          result = await readableRepository.insert(newBook);
          await readableRepository.setTimeTotalSeconds(result.id, timeTotalSeconds);
        } else {
          const ao3Url = values.ao3Url ?? '';
          const ao3WorkId = extractAo3WorkIdFromUrl(ao3Url) ?? `manual-${Date.now().toString()}`;

          const newFanfic: Omit<FanficReadable, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'fanfic',
            title: values.title,
            author: values.author,
            description: values.description,
            status: 'to-read',
            priority: priorityNumber,
            progressPercent: 0,
            progressMode: values.progressMode as ProgressMode,
            moodTags: values.moodTags,
            source: 'ao3',
            ao3WorkId,
            ao3Url,
            fandoms: fandomsList,
            relationships: relationshipsList,
            characters: charactersList,
            ao3Tags: ao3TagsList,
            rating: values.rating ?? null,
            warnings: warningsList,

            chapterCount: chapterCountNumber ?? totalChapters ?? null,
            availableChapters: values.progressMode === 'units' ? availableChapters : null,
            totalChapters: values.progressMode === 'units' ? totalChapters : null,

            currentChapter: null,
            complete: values.complete ?? false,
            wordCount: wordCountNumber ?? null,

            timeCurrentSeconds: null,
            timeTotalSeconds,
            startedAt,
            finishedAt,
            dnfAt,
            notes: null,
          };

          result = await readableRepository.insert(newFanfic);
          await readableRepository.setTimeTotalSeconds(result.id, timeTotalSeconds);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['readables'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });

      if (isEditing) navigation.goBack();
      else navigation.navigate('ReadableDetail', { id: result.id });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save readable', error);
      Alert.alert('Error', 'Something went wrong while saving this item. Please try again.');
    }
  };

  const currentStatus: ReadableStatus | null =
    isEditing && data ? (data.status as ReadableStatus) : null;

  const showStartedField =
    currentStatus === 'reading' || currentStatus === 'finished' || currentStatus === 'DNF';
  const showFinishedField = currentStatus === 'finished';
  const showDnfField = currentStatus === 'DNF';

  const typeLabel = currentType === 'book' ? 'Book' : 'Fanfic';

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Type
          </Text>

          {isEditing ? (
            <Text>{typeLabel}</Text>
          ) : (
            <SegmentedButtons
              value={currentType}
              onValueChange={(value) => setValue('type', value as 'book' | 'fanfic')}
              buttons={[
                { value: 'book', label: 'Book' },
                { value: 'fanfic', label: 'Fanfic' },
              ]}
            />
          )}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Progress display
          </Text>
          <SegmentedButtons
            value={progressMode}
            onValueChange={(v) =>
              setValue('progressMode', (v === 'time' ? 'time' : 'units') as EditProgressMode)
            }
            buttons={[
              { value: 'units', label: currentType === 'book' ? 'Pages' : 'Chapters' },
              { value: 'time', label: 'Time' },
            ]}
          />

          {/* Fanfic chapter totals (units mode only) */}
          {progressMode === 'units' && currentType === 'fanfic' && (
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Chapter totals
              </Text>

              <Controller
                control={control}
                name="availableChapters"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <TextInput
                      mode="outlined"
                      label="Available chapters (X)"
                      keyboardType="numeric"
                      value={value}
                      onChangeText={onChange}
                    />
                    {error?.message ? (
                      <HelperText type="error" visible>
                        {error.message}
                      </HelperText>
                    ) : null}
                  </>
                )}
              />

              <View style={{ height: 8 }} />

              <Controller
                control={control}
                name="totalChapters"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <TextInput
                      mode="outlined"
                      label="Total chapters (Y) — leave blank for ?"
                      keyboardType="numeric"
                      value={value}
                      onChangeText={onChange}
                    />
                    {error?.message ? (
                      <HelperText type="error" visible>
                        {error.message}
                      </HelperText>
                    ) : null}
                  </>
                )}
              />

              <HelperText type="info" visible>
                These control the X/Y display and unit-based % calculations.
              </HelperText>
            </View>
          )}

          {/* Total time editor (time mode only) */}
          {progressMode === 'time' && (
            <View style={styles.section}>
              <TimeHmsFields
                label="Total time"
                value={timeTotalHms}
                onChange={(next) => setValue('timeTotalHms', next)}
                helperText="Editable here. The details page will lock it once set."
              />
            </View>
          )}

          <ReadableMetadataForm
            type={currentType}
            control={control}
            genres={genresList}
            onChangeGenres={setGenresList}
            fandoms={fandomsList}
            onChangeFandoms={setFandomsList}
            relationships={relationshipsList}
            onChangeRelationships={setRelationshipsList}
            characters={charactersList}
            onChangeCharacters={setCharactersList}
            ao3Tags={ao3TagsList}
            onChangeAo3Tags={setAo3TagsList}
            warnings={warningsList}
            onChangeWarnings={setWarningsList}
            completeValue={completeValue}
            onChangeComplete={(val) => setValue('complete', val)}
            currentRating={(currentRating ?? null) as Ao3Rating | null}
            onChangeRating={(val) => setValue('rating', val)}
          />

          <View style={styles.moodsSection}>
            <MoodTagSelector
              selected={selectedMoodTags}
              onChange={(tags) => setValue('moodTags', tags)}
              title="Mood tags"
            />
          </View>

          {isEditing &&
            currentStatus &&
            (showStartedField || showFinishedField || showDnfField) && (
              <View style={styles.datesSection}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Reading timeline
                </Text>

                {showStartedField && (
                  <Controller
                    control={control}
                    name="startedAt"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <DatePickerField
                        label="Started reading"
                        value={value}
                        onChange={onChange}
                        errorMessage={error?.message}
                      />
                    )}
                  />
                )}

                {showFinishedField && (
                  <Controller
                    control={control}
                    name="finishedAt"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <DatePickerField
                        label="Finished on"
                        value={value}
                        onChange={onChange}
                        errorMessage={error?.message}
                      />
                    )}
                  />
                )}

                {showDnfField && (
                  <Controller
                    control={control}
                    name="dnfAt"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                      <DatePickerField
                        label="Marked DNF on"
                        value={value}
                        onChange={onChange}
                        errorMessage={error?.message}
                      />
                    )}
                  />
                )}
              </View>
            )}

          <View style={styles.footer}>
            <Button mode="contained" onPress={handleSubmit(onSubmit)}>
              {isEditing ? 'Save changes' : 'Add to library'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 4,
  },
  section: {
    marginTop: 8,
  },
  moodsSection: {
    marginTop: 16,
  },
  datesSection: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
  dateField: {
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    paddingBottom: 16,
  },
});

export default EditReadableScreen;
