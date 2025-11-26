// src/features/readables/screens/QuickAddReadableScreen.tsx
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, RadioButton, TextInput, Text } from 'react-native-paper';
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

type Navigation = NativeStackNavigationProp<RootStackParamList, 'QuickAddReadable'>;

interface FormState {
  type: ReadableType;
  title: string;
  author: string;
  priority: string; // keep as string for TextInput
  ao3Url: string;
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
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFanfic = form.type === 'fanfic';

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const priorityNumber = Number.parseInt(form.priority, 10);
  const priorityValid = !Number.isNaN(priorityNumber) && priorityNumber >= 1 && priorityNumber <= 5;

  const canSubmit =
    form.title.trim().length > 0 &&
    form.author.trim().length > 0 &&
    priorityValid &&
    (!isFanfic || form.ao3Url.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const priority = priorityNumber;

    try {
      if (form.type === 'book') {
        // BOOK FLOW
        let metadata = null;
        try {
          metadata = await fetchBookMetadata(form.title.trim(), form.author.trim());
        } catch {
          // metadata lookup failed or not implemented → manual fallback
        }

        if (metadata) {
          const book: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'book',
            title: metadata.title ?? form.title.trim(),
            author: metadata.author ?? form.author.trim(),
            description: null,
            status: DEFAULT_STATUS,
            priority,
            progressPercent: 0,
            moodTags: [],
            source: 'manual', // swap to googleBooks/openLibrary later if you like
            sourceId: null,
            pageCount: metadata.pageCount,
            genres: metadata.genres ?? [],
          };

          const inserted = await readableRepository.insert(book);

          await queryClient.invalidateQueries({ queryKey: ['readables'] });
          await queryClient.invalidateQueries({ queryKey: ['stats'] });

          navigation.replace('ReadableDetail', { id: inserted.id });
          return;
        }

        // Manual fallback: go to full edit screen with a draft
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
            moodTags: [],
          } as Partial<BookReadable>,
        });
        return;
      }

      // FANFIC FLOW
      let metadata = null;
      try {
        metadata = await fetchAo3Metadata(form.ao3Url.trim());
      } catch (err: any) {
        setError(err?.message ?? 'Failed to fetch metadata from AO3.');
      }

      if (metadata) {
        const ao3Url = form.ao3Url.trim();
        const ao3WorkId = extractAo3WorkIdFromUrl(ao3Url) ?? `manual-${Date.now().toString()}`;

        const fanfic: Omit<FanficReadable, 'id' | 'createdAt' | 'updatedAt'> = {
          type: 'fanfic',
          title: metadata.title ?? form.title.trim(),
          author: metadata.author ?? form.author.trim(),
          description: metadata.summary ?? null,
          status: DEFAULT_STATUS,
          priority,
          progressPercent: 0,
          moodTags: [],
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
        };

        const inserted = await readableRepository.insert(fanfic);

        await queryClient.invalidateQueries({ queryKey: ['readables'] });
        await queryClient.invalidateQueries({ queryKey: ['stats'] });

        navigation.replace('ReadableDetail', { id: inserted.id });
        return;
      }

      // Manual fallback for fanfic: go to full edit screen with draft
      navigation.replace('EditReadable', {
        draft: {
          type: 'fanfic',
          title: form.title.trim(),
          author: form.author.trim(),
          priority,
          status: DEFAULT_STATUS,
          createdAt: now,
          updatedAt: now,
          progressPercent: 0,
          moodTags: [],
          ao3Url: form.ao3Url.trim(),
        } as Partial<FanficReadable>,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add readable.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          Add to library
        </Text>

        <Text style={styles.label}>Type</Text>
        <RadioButton.Group
          onValueChange={(value) => updateField('type', value as ReadableType)}
          value={form.type}
        >
          <View style={styles.radioRow}>
            <RadioButton value="book" />
            <Text>Book</Text>
          </View>
          <View style={styles.radioRow}>
            <RadioButton value="fanfic" />
            <Text>Fanfic (AO3)</Text>
          </View>
        </RadioButton.Group>

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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    marginTop: 12,
  },
  submitButton: {
    marginTop: 24,
  },
});

export default QuickAddReadableScreen;
