// src/features/readables/screens/EditReadableScreen.tsx
import React, { useEffect, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ReadableMetadataForm from '@src/features/readables/components/ReadableMetadataForm';
import MoodTagSelector from '@src/features/moods/components/MoodTagSelector';

import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import type { BookSource, ReadableItem, BookReadable, FanficReadable, Ao3Rating } from '../types';
import { readableRepository } from '../services/readableRepository';
import { ALL_MOOD_TAGS, MoodTag } from '@src/features/moods/types';
import { extractAo3WorkIdFromUrl } from '@src/utils/text';

type EditRoute = RouteProp<RootStackParamList, 'EditReadable'>;
type RootNav = NavigationProp<RootStackParamList>;

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
}

// Schema: keep it focused on scalar fields; list fields are handled via local state
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
  })
  .required() as yup.ObjectSchema<EditReadableFormValues>;

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
    },
  });

  const currentType = watch('type');
  const selectedMoodTags = watch('moodTags');
  const currentRating = watch('rating');
  const completeValue = watch('complete');

  // array state for book + fanfic list fields
  const [genresList, setGenresList] = useState<string[]>([]); // book
  const [fandomsList, setFandomsList] = useState<string[]>([]);
  const [relationshipsList, setRelationshipsList] = useState<string[]>([]);
  const [charactersList, setCharactersList] = useState<string[]>([]);
  const [ao3TagsList, setAo3TagsList] = useState<string[]>([]);
  const [warningsList, setWarningsList] = useState<string[]>([]);

  // Editing existing readable → hydrate from DB
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

  // Create mode with draft (from QuickAdd fallback) → hydrate from draft
  useEffect(() => {
    if (!isEditing && draft) {
      const baseDefaults: Partial<EditReadableFormValues> = {
        type: draft.type ?? 'book',
        title: draft.title ?? '',
        author: draft.author ?? '',
        description: (draft.description as string | undefined) ?? '',
        priority: draft.priority != null ? String(draft.priority) : '3',
        moodTags: draft.moodTags ?? [],
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

  const onSubmit = async (values: EditReadableFormValues) => {
    try {
      const priorityNumber = parseInt(values.priority, 10);
      const pageCountNumber =
        values.pageCount != null ? parseInt(values.pageCount, 10) || undefined : undefined;
      const wordCountNumber =
        values.wordCount != null ? parseInt(values.wordCount, 10) || undefined : undefined;
      const chapterCountNumber =
        values.chapterCount != null ? parseInt(values.chapterCount, 10) || undefined : undefined;

      const moodTags = values.moodTags;

      const genres = genresList;
      const fandoms = fandomsList;
      const relationships = relationshipsList;
      const characters = charactersList;
      const ao3Tags = ao3TagsList;
      const warnings = warningsList;
      const complete = values.complete ?? false;
      const rating = values.rating ?? null;

      let result: ReadableItem;

      if (isEditing && data) {
        const existing = data;

        if (values.type === 'book') {
          const updatedBook: BookReadable = {
            ...(existing as ReadableItem),
            type: 'book',
            title: values.title,
            author: values.author,
            description: values.description,
            priority: priorityNumber,
            status: existing.status,
            moodTags,
            source: existing.type === 'book' ? existing.source : 'manual',
            sourceId: existing.type === 'book' ? (existing.sourceId ?? null) : null,
            pageCount: pageCountNumber ?? null,
            genres,
          };

          result = await readableRepository.update(updatedBook);
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
            moodTags,
            source: 'ao3',
            ao3Url,
            ao3WorkId,
            fandoms,
            relationships,
            characters,
            ao3Tags,
            rating,
            warnings,
            chapterCount: chapterCountNumber ?? null,
            complete,
            wordCount: wordCountNumber ?? null,
          };

          result = await readableRepository.update(updatedFanfic);
        }
      } else {
        // CREATE
        if (values.type === 'book') {
          const newBook: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'book',
            title: values.title,
            author: values.author,
            description: values.description,
            status: 'to-read',
            priority: priorityNumber,
            progressPercent: 0,
            moodTags,
            source: 'manual',
            sourceId: null,
            pageCount: pageCountNumber ?? null,
            genres,
          };

          result = await readableRepository.insert(newBook);
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
            moodTags,
            source: 'ao3',
            ao3WorkId,
            ao3Url,
            fandoms,
            relationships,
            characters,
            ao3Tags,
            rating,
            warnings,
            chapterCount: chapterCountNumber ?? null,
            complete,
            wordCount: wordCountNumber ?? null,
          };

          result = await readableRepository.insert(newFanfic);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['readables'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });

      if (isEditing) {
        navigation.goBack();
      } else {
        navigation.navigate('ReadableDetail', { id: result.id });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save readable', error);
      Alert.alert('Error', 'Something went wrong while saving this item. Please try again.');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Type
        </Text>
        <SegmentedButtons
          value={currentType}
          onValueChange={(value) => setValue('type', value as 'book' | 'fanfic')}
          buttons={[
            { value: 'book', label: 'Book' },
            { value: 'fanfic', label: 'Fanfic' },
          ]}
        />

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
          currentRating={currentRating ?? null}
          onChangeRating={(val) => setValue('rating', val)}
        />

        <View style={styles.moodsSection}>
          <MoodTagSelector
            selected={selectedMoodTags}
            onChange={(tags) => setValue('moodTags', tags)}
            title="Mood tags"
          />
        </View>

        <View style={styles.footer}>
          <Button mode="contained" onPress={handleSubmit(onSubmit)}>
            {isEditing ? 'Save changes' : 'Add to library'}
          </Button>
        </View>
      </ScrollView>
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
  moodsSection: {
    marginTop: 16,
  },
  footer: {
    marginTop: 24,
  },
});

export default EditReadableScreen;
