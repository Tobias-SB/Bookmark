// src/features/readables/screens/EditReadableScreen.tsx
import React, { useEffect } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, SegmentedButtons, Text, Chip } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import TextInputField from '@src/components/common/TextInputField';
import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import type { BookSource, ReadableItem, BookReadable, FanficReadable } from '../types';
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
}

// Schema: no SchemaOf, to keep it compatible with your yup version.
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
  })
  .required() as yup.ObjectSchema<EditReadableFormValues>;

const EditReadableScreen: React.FC = () => {
  const route = useRoute<EditRoute>();
  const navigation = useNavigation<RootNav>();
  const queryClient = useQueryClient();

  const id = route.params?.id;
  const isEditing = !!id;

  const { data, isLoading } = useReadableById(id);

  const { control, handleSubmit, reset, watch, setValue } = useForm<EditReadableFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      type: 'book',
      title: '',
      author: '',
      description: '',
      priority: '3',
      source: 'manual',
      pageCount: '',
      wordCount: '',
      ao3Url: '',
      moodTags: [],
    },
  });

  const currentType = watch('type');
  const selectedMoodTags = watch('moodTags');

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
        } as EditReadableFormValues);
      } else {
        reset({
          ...baseDefaults,
          source: 'ao3',
          pageCount: '',
          wordCount: readable.wordCount ? String(readable.wordCount) : '',
          ao3Url: readable.ao3Url,
        } as EditReadableFormValues);
      }
    }
  }, [data, isEditing, reset]);

  if (isEditing && isLoading && !data) {
    return (
      <Screen>
        <LoadingState message="Loading readable…" />
      </Screen>
    );
  }

  const toggleMoodTag = (tag: MoodTag) => {
    const hasTag = selectedMoodTags.includes(tag);
    if (hasTag) {
      setValue(
        'moodTags',
        selectedMoodTags.filter((t) => t !== tag),
      );
    } else {
      setValue('moodTags', [...selectedMoodTags, tag]);
    }
  };

  const onSubmit = async (values: EditReadableFormValues) => {
    try {
      const priorityNumber = parseInt(values.priority, 10);
      const pageCountNumber =
        values.pageCount != null ? parseInt(values.pageCount, 10) || undefined : undefined;
      const wordCountNumber =
        values.wordCount != null ? parseInt(values.wordCount, 10) || undefined : undefined;

      const moodTags = values.moodTags;

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
            source: (values.source as BookSource) ?? 'manual',
            sourceId: existing.type === 'book' ? existing.sourceId : null,
            pageCount: pageCountNumber ?? null,
            genres: existing.type === 'book' ? existing.genres : [],
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
            fandoms: existing.type === 'fanfic' ? existing.fandoms : [],
            relationships: existing.type === 'fanfic' ? existing.relationships : [],
            characters: existing.type === 'fanfic' ? existing.characters : [],
            ao3Tags: existing.type === 'fanfic' ? existing.ao3Tags : [],
            rating: existing.type === 'fanfic' ? existing.rating : null,
            warnings: existing.type === 'fanfic' ? existing.warnings : [],
            chapterCount: existing.type === 'fanfic' ? existing.chapterCount : null,
            complete: existing.type === 'fanfic' ? existing.complete : null,
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
            moodTags,
            source: (values.source as BookSource) ?? 'manual',
            sourceId: null,
            pageCount: pageCountNumber ?? null,
            genres: [],
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
            moodTags,
            source: 'ao3',
            ao3WorkId,
            ao3Url,
            fandoms: [],
            relationships: [],
            characters: [],
            ao3Tags: [],
            rating: null,
            warnings: [],
            chapterCount: null,
            complete: null,
            wordCount: wordCountNumber ?? null,
          };

          result = await readableRepository.insert(newFanfic);
        }
      }

      // Make sure the queue refreshes
      await queryClient.invalidateQueries({ queryKey: ['readables', 'to-read'] });

      // For now, just go back to where we came from (usually the Queue or Detail screen)
      navigation.goBack();
    } catch (error) {
      // Log for debugging & show a simple alert so it doesn't fail silently
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

        <View style={styles.field}>
          <TextInputField control={control} name="title" label="Title" />
        </View>
        <View style={styles.field}>
          <TextInputField control={control} name="author" label="Author" />
        </View>
        <View style={styles.field}>
          <TextInputField control={control} name="description" label="Description" multiline />
        </View>
        <View style={styles.field}>
          <TextInputField
            control={control}
            name="priority"
            label="Priority (1–5)"
            keyboardType="numeric"
          />
        </View>

        {currentType === 'book' ? (
          <View style={styles.field}>
            <TextInputField
              control={control}
              name="pageCount"
              label="Page count"
              keyboardType="numeric"
            />
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <TextInputField control={control} name="ao3Url" label="AO3 URL" />
            </View>
            <View style={styles.field}>
              <TextInputField
                control={control}
                name="wordCount"
                label="Word count"
                keyboardType="numeric"
              />
            </View>
          </>
        )}

        <View style={styles.moodsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Mood tags
          </Text>
          <View style={styles.moodChips}>
            {ALL_MOOD_TAGS.map((tag) => {
              const selected = selectedMoodTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  style={styles.moodChip}
                  selected={selected}
                  onPress={() => toggleMoodTag(tag)}
                >
                  {tag.replace('-', ' ')}
                </Chip>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Button mode="contained" onPress={handleSubmit(onSubmit)}>
            {isEditing ? 'Save changes' : 'Add to queue'}
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
  field: {
    marginTop: 12,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  moodsSection: {
    marginTop: 16,
  },
  moodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moodChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  footer: {
    marginTop: 24,
  },
});

export default EditReadableScreen;
