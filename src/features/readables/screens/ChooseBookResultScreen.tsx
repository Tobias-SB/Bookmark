import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, HelperText } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import type { RootStackParamList } from '@src/navigation/types';
import type { BookReadable } from '@src/features/readables/types';
import { readableRepository } from '@src/features/readables/services/readableRepository';

type RouteT = RouteProp<RootStackParamList, 'ChooseBookResult'>;
type NavT = NativeStackNavigationProp<RootStackParamList, 'ChooseBookResult'>;

function authorsToString(authors: string[]) {
  const cleaned = authors.map((a) => a.trim()).filter(Boolean);
  return cleaned.join(', ');
}

const ChooseBookResultScreen: React.FC = () => {
  const navigation = useNavigation<NavT>();
  const route = useRoute<RouteT>();
  const queryClient = useQueryClient();

  const { title, author, priority, moodTags, candidates } = route.params;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCandidates = Array.isArray(candidates) && candidates.length > 0;

  const headerText = useMemo(() => {
    if (!hasCandidates) return 'No results';
    if (candidates.length === 1) return 'We found a match';
    return `Choose the right book (${candidates.length})`;
  }, [candidates.length, hasCandidates]);

  async function handleSelect(candidateIndex: number) {
    if (submitting) return;

    const candidate = candidates[candidateIndex];
    if (!candidate) return;

    setSubmitting(true);
    setError(null);

    try {
      const meta = candidate.metadata;

      // We still store authors as a single string today (comma-separated),
      // to avoid a DB migration right now.
      const authorString = meta.authors.length > 0 ? authorsToString(meta.authors) : author.trim();

      const book: Omit<BookReadable, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'book',
        title: meta.title ?? title.trim(),
        author: authorString,
        description: meta.description ?? null,
        status: 'to-read',
        priority,
        progressPercent: 0,
        moodTags,
        source: 'manual',
        sourceId: null,
        pageCount: meta.pageCount ?? null,
        genres: meta.genres ?? [],
        progressMode: 'units',
      };

      const inserted = await readableRepository.insert(book);

      await queryClient.invalidateQueries({ queryKey: ['readables'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });

      navigation.replace('ReadableDetail', { id: inserted.id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add book.';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          {headerText}
        </Text>

        <Text style={styles.subtitle}>
          Search: {title.trim()}
          {author.trim() ? ` — ${author.trim()}` : ''}
        </Text>

        {!hasCandidates && (
          <HelperText type="error" visible={true}>
            No candidate results were provided.
          </HelperText>
        )}

        {error && (
          <HelperText type="error" visible={true}>
            {error}
          </HelperText>
        )}

        {candidates.map((c, idx) => {
          const meta = c.metadata;

          const authors =
            meta.authors.length > 0 ? authorsToString(meta.authors) : 'Unknown author';

          const genres = (meta.genres ?? []).slice(0, 6);
          const genresText = genres.length ? genres.join(' · ') : 'No genres';

          const pagesText =
            meta.pageCount != null ? `${meta.pageCount} pages` : 'Page count unknown';

          return (
            <Card key={c.id} style={styles.card} mode="outlined">
              <Card.Content>
                <Text variant="titleMedium">{meta.title ?? 'Unknown title'}</Text>
                <Text style={styles.metaLine}>{authors}</Text>
                <Text style={styles.metaLine}>{pagesText}</Text>
                <Text style={styles.genres}>{genresText}</Text>

                {meta.description ? (
                  <Text numberOfLines={4} style={styles.description}>
                    {meta.description}
                  </Text>
                ) : null}
              </Card.Content>

              <Card.Actions>
                <Button
                  mode="contained"
                  onPress={() => handleSelect(idx)}
                  loading={submitting}
                  disabled={submitting}
                >
                  Use this one
                </Button>
              </Card.Actions>
            </Card>
          );
        })}

        <View style={styles.footer}>
          <Button mode="text" disabled={submitting} onPress={() => navigation.goBack()}>
            Back
          </Button>
        </View>
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
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.8,
  },
  card: {
    marginBottom: 12,
  },
  metaLine: {
    marginTop: 4,
    opacity: 0.85,
  },
  genres: {
    marginTop: 6,
    opacity: 0.75,
  },
  description: {
    marginTop: 10,
    opacity: 0.9,
  },
  footer: {
    marginTop: 8,
  },
});

export default ChooseBookResultScreen;
