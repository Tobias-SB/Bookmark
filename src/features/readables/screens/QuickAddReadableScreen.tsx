import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, HelperText, SegmentedButtons, TextInput, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import type { RootStackParamList } from '@src/navigation/types';
import type { BookReadable, FanficReadable, ReadableStatus, ReadableType } from '../types';
import { readableRepository } from '../services/readableRepository';
import { fetchAo3Metadata } from '../services/ao3MetadataService';
import { fetchBookMetadata } from '../services/bookMetadataService';
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
}

const DEFAULT_STATUS: ReadableStatus = 'to-read';

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
                // We don’t have title/author because AO3 blocked us
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
      'No matching book could be found from metadata. Please check the spelling of the title and author and try again, or add the details manually.';

    setError(message);

    Alert.alert('Book not found', message, [
      {
        text: 'Check spelling',
        style: 'cancel',
      },
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

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const priority = priorityNumber;
    const moodTags = form.moodTags;

    try {
      if (isBook) {
        // BOOK FLOW
        let metadata: Awaited<ReturnType<typeof fetchBookMetadata>> | null = null;
        let metadataNotImplemented = false;
        let metadataErrored = false;

        try {
          metadata = await fetchBookMetadata(form.title.trim(), form.author.trim());
        } catch (err: unknown) {
          // Current contract: booksApi throws a structured NOT_IMPLEMENTED while still stubbed.
          if (err instanceof BooksApiError && err.kind === 'NOT_IMPLEMENTED') {
            metadataNotImplemented = true;
          } else {
            metadataErrored = true;
          }
        }

        // If the API is implemented and we got no match (null) OR we had an actual error,
        // ask the user whether to add manually.
        if (!metadata && !metadataNotImplemented) {
          if (metadataErrored) {
            // Keep the existing UX: same dialog, but the user still gets a path forward.
            // (We can add a more specific “network error” dialog later.)
          }
          showBookNoMatchDialog(priority, moodTags);
          setSubmitting(false);
          return;
        }

        const book: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
          type: 'book',
          title: metadata?.title ?? form.title.trim(),
          author: metadata?.author ?? form.author.trim(),
          description: metadata?.description ?? null,
          status: DEFAULT_STATUS,
          priority,
          progressPercent: 0,
          moodTags,
          source: 'manual',
          sourceId: null,
          pageCount: metadata?.pageCount ?? null,
          genres: metadata?.genres ?? [],
          progressMode: 'units',
        };

        const inserted = await readableRepository.insert(book);

        await queryClient.invalidateQueries({ queryKey: ['readables'] });
        await queryClient.invalidateQueries({ queryKey: ['stats'] });

        navigation.replace('ReadableDetail', { id: inserted.id });
        return;
      }

      // FANFIC FLOW
      try {
        const metadata = await fetchAo3Metadata(form.ao3Url.trim());

        // Treat "metadata with no title and no author" as failure too
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
        // Any error from AO3 → treat as locked / unavailable
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
      // We also early-return with setSubmitting(false) in some branches
      if (submitting) {
        setSubmitting(false);
      }
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
              label="Author"
              value={form.author}
              onChangeText={(text) => updateField('author', text)}
              style={styles.input}
            />
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
    marginTop: 8,
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
