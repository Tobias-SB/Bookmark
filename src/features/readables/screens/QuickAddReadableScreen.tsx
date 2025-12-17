import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, HelperText, SegmentedButtons, TextInput, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import type { RootStackParamList, BookMetadataCandidateNav } from '@src/navigation/types';
import type { BookReadable, FanficReadable, ReadableStatus, ReadableType } from '../types';
import { readableRepository } from '../services/readableRepository';
import { fetchAo3Metadata } from '../services/ao3MetadataService';
import { searchBookMetadataCandidates, type BookSearchMode } from '../services/bookMetadataService';
import { extractAo3WorkIdFromUrl } from '@src/utils/text';
import { type MoodTag } from '@src/features/moods/types';
import MoodTagSelector from '@src/features/moods/components/MoodTagSelector';
import { BooksApiError } from '@src/services/api/booksApi';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'QuickAddReadable'>;

interface FormState {
  type: ReadableType;
  title: string;
  author: string;
  priority: string; // keep as string for TextInput
  ao3Url: string;
  moodTags: MoodTag[];
  bookSearchMode: BookSearchMode;
}

const DEFAULT_STATUS: ReadableStatus = 'to-read';

function authorsToString(authors: string[]) {
  const cleaned = authors.map((a) => a.trim()).filter(Boolean);
  return cleaned.join(', ');
}

function toNavCandidates(
  candidates: Array<{
    id: string;
    score: number;
    titleScore: number;
    authorScore: number;
    metadata: {
      title: string | null;
      authors: string[];
      pageCount: number | null;
      genres: string[];
      description: string | null;
      coverUrl: string | null;
    };
  }>,
): BookMetadataCandidateNav[] {
  return candidates.map((c) => ({
    id: c.id,
    score: c.score,
    titleScore: c.titleScore,
    authorScore: c.authorScore,
    metadata: {
      title: c.metadata.title ?? null,
      authors: Array.isArray(c.metadata.authors) ? c.metadata.authors : [],
      pageCount: c.metadata.pageCount ?? null,
      genres: Array.isArray(c.metadata.genres) ? c.metadata.genres : [],
      description: c.metadata.description ?? null,
      coverUrl: c.metadata.coverUrl ?? null,
    },
  }));
}

const QuickAddReadableScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    type: 'book',
    title: '',
    author: '',
    priority: '3',
    ao3Url: '',
    moodTags: [],
    bookSearchMode: 'flexible',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFanfic = form.type === 'fanfic';
  const isBook = form.type === 'book';

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const priorityNumber = Number.parseInt(form.priority, 10);
  const priorityValid = !Number.isNaN(priorityNumber) && priorityNumber >= 1 && priorityNumber <= 5;

  const canSubmit =
    priorityValid &&
    ((isBook && form.title.trim().length > 0 && form.author.trim().length > 0) ||
      (isFanfic && form.ao3Url.trim().length > 0));

  function showAo3ErrorDialog(priority: number, moodTags: MoodTag[]) {
    const now = new Date().toISOString();
    const ao3Url = form.ao3Url.trim();

    const message =
      'This AO3 work could not be fetched. It may be locked and only available to logged-in members, so Bookmark cannot pull the details automatically.';

    setError(message);

    Alert.alert(
      'Could not fetch from AO3',
      `${message}\n\nDo you want to add it manually instead?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add manually',
          onPress: () => {
            navigation.replace('EditReadable', {
              draft: {
                type: 'fanfic',
                title: '',
                author: '',
                priority,
                status: DEFAULT_STATUS,
                createdAt: now,
                updatedAt: now,
                progressPercent: 0,
                moodTags,
                ao3Url,
              } as Partial<FanficReadable>,
            });
          },
        },
      ],
    );
  }

  function showBookNoMatchDialog(priority: number, moodTags: MoodTag[]) {
    const now = new Date().toISOString();

    const message =
      'No matching book could be found. Please check the spelling of the title and author and try again, or add the details manually.';

    setError(message);

    Alert.alert('Book not found', message, [
      { text: 'Check spelling', style: 'cancel' },
      {
        text: 'Add manually',
        onPress: () => {
          navigation.replace('EditReadable', {
            draft: {
              type: 'book',
              title: form.title.trim(),
              author: form.author.trim(),
              priority,
              status: DEFAULT_STATUS,
              createdAt: now,
              updatedAt: now,
              progressPercent: 0,
              moodTags,
            } as Partial<BookReadable>,
          });
        },
      },
    ]);
  }

  function showBookLookupErrorDialog(priority: number, moodTags: MoodTag[], kind: string) {
    const now = new Date().toISOString();

    const message =
      kind === 'NETWORK'
        ? 'We couldn’t reach the book metadata service. Check your connection and try again, or add it manually.'
        : 'The book metadata service had a problem. Try again, or add it manually.';

    setError(message);

    Alert.alert('Could not fetch book details', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Try again' },
      {
        text: 'Add manually',
        onPress: () => {
          navigation.replace('EditReadable', {
            draft: {
              type: 'book',
              title: form.title.trim(),
              author: form.author.trim(),
              priority,
              status: DEFAULT_STATUS,
              createdAt: now,
              updatedAt: now,
              progressPercent: 0,
              moodTags,
            } as Partial<BookReadable>,
          });
        },
      },
    ]);
  }

  async function insertBookFromMetadata(priority: number, moodTags: MoodTag[], meta: any) {
    const authorString =
      meta?.authors && Array.isArray(meta.authors) && meta.authors.length > 0
        ? authorsToString(meta.authors)
        : form.author.trim();

    const book: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'book',
      title: meta?.title ?? form.title.trim(),
      author: authorString,
      description: meta?.description ?? null,
      status: DEFAULT_STATUS,
      priority,
      progressPercent: 0,
      moodTags,
      source: 'manual',
      sourceId: null,
      pageCount: meta?.pageCount ?? null,
      genres: meta?.genres ?? [],
      progressMode: 'units',
    };

    const inserted = await readableRepository.insert(book);

    await queryClient.invalidateQueries({ queryKey: ['readables'] });
    await queryClient.invalidateQueries({ queryKey: ['stats'] });

    navigation.replace('ReadableDetail', { id: inserted.id });
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const priority = priorityNumber;
    const moodTags = form.moodTags;

    try {
      if (isBook) {
        try {
          const candidates = await searchBookMetadataCandidates(
            form.title.trim(),
            form.author.trim(),
            {
              mode: form.bookSearchMode,
            },
          );

          if (candidates.length === 0) {
            showBookNoMatchDialog(priority, moodTags);
            setSubmitting(false);
            return;
          }

          if (candidates.length === 1) {
            await insertBookFromMetadata(priority, moodTags, candidates[0].metadata);
            return;
          }

          const navCandidates = toNavCandidates(candidates);

          navigation.navigate('ChooseBookResult', {
            title: form.title.trim(),
            author: form.author.trim(),
            priority,
            moodTags,
            mode: form.bookSearchMode,
            candidates: navCandidates,
          });

          setSubmitting(false);
          return;
        } catch (err: unknown) {
          if (err instanceof BooksApiError && err.kind === 'NOT_IMPLEMENTED') {
            await insertBookFromMetadata(priority, moodTags, null);
            return;
          }

          if (err instanceof BooksApiError) {
            showBookLookupErrorDialog(priority, moodTags, err.kind);
            setSubmitting(false);
            return;
          }

          showBookLookupErrorDialog(priority, moodTags, 'UNKNOWN');
          setSubmitting(false);
          return;
        }
      }

      // FANFIC FLOW
      try {
        const metadata = await fetchAo3Metadata(form.ao3Url.trim());

        const looksEmpty =
          !metadata ||
          ((metadata.title == null || metadata.title.trim() === '') &&
            (metadata.author == null || metadata.author.trim() === ''));

        if (!metadata || looksEmpty) {
          showAo3ErrorDialog(priority, moodTags);
          setSubmitting(false);
          return;
        }

        const ao3Url = form.ao3Url.trim();
        const ao3WorkId = extractAo3WorkIdFromUrl(ao3Url) ?? `manual-${Date.now().toString()}`;

        const fanfic: Omit<FanficReadable, 'id' | 'createdAt' | 'updatedAt'> = {
          type: 'fanfic',
          title: metadata.title ?? '',
          author: metadata.author ?? '',
          description: metadata.summary ?? null,
          status: DEFAULT_STATUS,
          priority,
          progressPercent: 0,
          moodTags,
          source: 'ao3',
          ao3WorkId,
          ao3Url,
          fandoms: metadata.fandoms,
          relationships: metadata.relationships,
          characters: metadata.characters,
          ao3Tags: metadata.tags,
          rating: metadata.rating,
          warnings: metadata.warnings,
          chapterCount: metadata.chapterCount,
          complete: metadata.complete,
          wordCount: metadata.wordCount,
          progressMode: 'units',
        };

        const inserted = await readableRepository.insert(fanfic);

        await queryClient.invalidateQueries({ queryKey: ['readables'] });
        await queryClient.invalidateQueries({ queryKey: ['stats'] });

        navigation.replace('ReadableDetail', { id: inserted.id });
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('fetchAo3Metadata failed', err);
        showAo3ErrorDialog(priority, moodTags);
        setSubmitting(false);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add readable.';
      setError(msg);
    } finally {
      if (submitting) setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          Quick add to library
        </Text>

        <Text style={styles.label}>Type</Text>
        <SegmentedButtons
          value={form.type}
          onValueChange={(value) => updateField('type', value as ReadableType)}
          buttons={[
            { value: 'book', label: 'Book' },
            { value: 'fanfic', label: 'Fanfic (AO3)' },
          ]}
        />

        {isBook && (
          <>
            <TextInput
              label="Title"
              value={form.title}
              onChangeText={(text) => updateField('title', text)}
              style={styles.input}
            />

            <TextInput
              label="Author(s)"
              value={form.author}
              onChangeText={(text) => updateField('author', text)}
              style={styles.input}
            />

            <Text style={styles.label}>Search mode</Text>
            <SegmentedButtons
              value={form.bookSearchMode}
              onValueChange={(value) => updateField('bookSearchMode', value as BookSearchMode)}
              buttons={[
                { value: 'flexible', label: 'Flexible' },
                { value: 'strict', label: 'Strict' },
              ]}
            />
            <HelperText type="info" visible={true}>
              Flexible is better for messy metadata. Strict avoids wrong matches.
            </HelperText>
          </>
        )}

        {isFanfic && (
          <TextInput
            label="AO3 URL"
            value={form.ao3Url}
            onChangeText={(text) => updateField('ao3Url', text)}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        <TextInput
          label="Priority (1–5)"
          value={form.priority}
          onChangeText={(text) => updateField('priority', text)}
          style={styles.input}
          keyboardType="number-pad"
        />
        {!priorityValid && (
          <HelperText type="error" visible={!priorityValid}>
            Priority must be between 1 and 5
          </HelperText>
        )}

        <View style={styles.moodsSection}>
          <MoodTagSelector
            selected={form.moodTags}
            onChange={(tags) => updateField('moodTags', tags)}
            title="Mood tags"
          />
        </View>

        {error && (
          <HelperText type="error" visible={true}>
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          style={styles.submitButton}
        >
          Add to library
        </Button>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  title: {
    marginBottom: 16,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    marginTop: 12,
  },
  moodsSection: {
    marginTop: 16,
  },
  submitButton: {
    marginTop: 24,
  },
});

export default QuickAddReadableScreen;
