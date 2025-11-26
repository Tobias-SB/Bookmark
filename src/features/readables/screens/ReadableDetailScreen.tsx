// src/features/readables/screens/ReadableDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Linking, Alert, ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Chip, Text, Button, TextInput } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import {
  READABLE_STATUS_LABELS,
  type ReadableStatus,
  type FanficReadable,
} from '@src/features/readables/types';

type DetailRoute = RouteProp<RootStackParamList, 'ReadableDetail'>;
type RootNav = NavigationProp<RootStackParamList>;

const ReadableDetailScreen: React.FC = () => {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<RootNav>();
  const { id } = route.params;
  const { data, isLoading, isError, refetch } = useReadableById(id);
  const queryClient = useQueryClient();

  const [progressDraft, setProgressDraft] = useState<number>(0);
  const [tagsExpanded, setTagsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (data) {
      setProgressDraft(data.progressPercent ?? 0);
    }
  }, [data]);

  if (isLoading && !data) {
    return (
      <Screen>
        <LoadingState message="Loading readable…" />
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <ErrorState message="Could not load this readable." onRetry={refetch} />
      </Screen>
    );
  }

  const item = data;

  const invalidateReadablesAndStats = async () => {
    await queryClient.invalidateQueries({ queryKey: ['readables'] });
    await queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  const handleOpenAo3 = () => {
    if (item.type === 'fanfic' && item.ao3Url) {
      Linking.openURL(item.ao3Url).catch(() => {
        // could show a toast/snackbar here
      });
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditReadable', { id: item.id });
  };

  const handleStartReading = async () => {
    try {
      await readableRepository.updateStatus(item.id, 'reading');
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark as reading', e);
    }
  };

  const handleSaveProgress = async () => {
    try {
      await readableRepository.updateProgress(item.id, progressDraft);
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update progress', e);
    }
  };

  const handleMarkFinished = async () => {
    try {
      // updateStatus will also set progress_percent = 100
      await readableRepository.updateStatus(item.id, 'finished');
      await invalidateReadablesAndStats();
      navigation.goBack();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark as finished', e);
    }
  };

  const handleMarkDnf = async () => {
    try {
      // Make sure the last progress is saved before DNF
      await readableRepository.updateProgress(item.id, progressDraft);
      await readableRepository.updateStatus(item.id, 'DNF');
      await invalidateReadablesAndStats();
      navigation.goBack();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark as DNF', e);
    }
  };

  const handleMoveToStatus = async (status: ReadableStatus) => {
    try {
      await readableRepository.updateStatus(item.id, status);
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Failed to move to status ${status}`, e);
    }
  };

  const handleProgressChange = (text: string) => {
    const numeric = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(numeric)) {
      setProgressDraft(0);
    } else {
      const clamped = Math.min(100, Math.max(0, numeric));
      setProgressDraft(clamped);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete readable',
      'Are you sure you want to delete this readable from your library? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ],
    );
  };

  const handleDelete = async () => {
    try {
      await readableRepository.delete(item.id);
      await invalidateReadablesAndStats();
      navigation.goBack();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete readable', e);
      Alert.alert('Error', 'Something went wrong while deleting this item.');
    }
  };

  const renderFanficMetadata = () => {
    if (item.type !== 'fanfic') return null;
    const fanfic = item as FanficReadable;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fanfic details</Text>

        {fanfic.wordCount != null && (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Word count: </Text>
            {fanfic.wordCount.toLocaleString()}
          </Text>
        )}

        {fanfic.rating && (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Rating: </Text>
            {fanfic.rating}
          </Text>
        )}

        {fanfic.complete != null && (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Complete: </Text>
            {fanfic.complete ? 'Yes' : 'No'}
          </Text>
        )}

        {fanfic.chapterCount != null && (
          <Text style={styles.metaText}>
            <Text style={styles.metaLabel}>Chapters: </Text>
            {fanfic.chapterCount}
          </Text>
        )}

        {fanfic.fandoms.length > 0 && (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Fandoms</Text>
            <View style={styles.tagChips}>
              {fanfic.fandoms.map((fandom) => (
                <Chip key={fandom} style={styles.tagChip}>
                  {fandom}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {fanfic.relationships.length > 0 && (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Relationships</Text>
            <View style={styles.tagChips}>
              {fanfic.relationships.map((rel) => (
                <Chip key={rel} style={styles.tagChip}>
                  {rel}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {fanfic.characters.length > 0 && (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Characters</Text>
            <View style={styles.tagChips}>
              {fanfic.characters.map((char) => (
                <Chip key={char} style={styles.tagChip}>
                  {char}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {fanfic.ao3Tags.length > 0 && (
          <View style={styles.metaBlock}>
            <View style={styles.tagsHeaderRow}>
              <Text style={styles.metaLabel}>Tags</Text>
              <Button mode="text" compact onPress={() => setTagsExpanded((prev) => !prev)}>
                {tagsExpanded ? 'Hide tags' : 'Show tags'}
              </Button>
            </View>
            {tagsExpanded && (
              <View style={styles.tagChips}>
                {fanfic.ao3Tags.map((tag) => (
                  <Chip key={tag} style={styles.tagChip}>
                    {tag}
                  </Chip>
                ))}
              </View>
            )}
          </View>
        )}

        {fanfic.warnings.length > 0 && (
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Warnings</Text>
            <View style={styles.tagChips}>
              {fanfic.warnings.map((warning) => (
                <Chip key={warning} style={styles.tagChip}>
                  {warning}
                </Chip>
              ))}
            </View>
          </View>
        )}

        <Button mode="contained-tonal" style={styles.button} onPress={handleOpenAo3}>
          Open on AO3
        </Button>
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="headlineMedium">{item.title}</Text>
          <Text variant="titleMedium">{item.author}</Text>
        </View>

        <View style={styles.row}>
          <Chip style={styles.chip}>{item.type === 'book' ? 'Book' : 'Fanfic'}</Chip>
          <Chip style={styles.chip}>Priority {item.priority}</Chip>
          <Chip style={styles.chip}>Status: {READABLE_STATUS_LABELS[item.status]}</Chip>
        </View>

        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : (
          <Text style={styles.descriptionMuted}>No description.</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading progress</Text>
          <Text>Current progress: {item.progressPercent}%</Text>

          {(item.status === 'reading' || item.status === 'DNF') && (
            <>
              <TextInput
                mode="outlined"
                label="Progress (%)"
                keyboardType="numeric"
                value={String(progressDraft)}
                onChangeText={handleProgressChange}
                style={styles.progressInput}
              />
              <Button mode="outlined" onPress={handleSaveProgress} style={styles.button}>
                Save progress
              </Button>
            </>
          )}
        </View>

        {item.moodTags.length > 0 ? (
          <View style={styles.moods}>
            <Text style={styles.sectionTitle}>Mood tags</Text>
            <View style={styles.moodChips}>
              {item.moodTags.map((tag) => (
                <Chip key={tag} style={styles.moodChip}>
                  {tag.replace('-', ' ')}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {renderFanficMetadata()}

        <View style={styles.footer}>
          <Button mode="contained" onPress={handleEdit} style={styles.button}>
            Edit
          </Button>

          {item.status === 'to-read' && (
            <Button mode="outlined" onPress={handleStartReading} style={styles.button}>
              Start reading
            </Button>
          )}

          {item.status === 'reading' && (
            <>
              <Button mode="contained" onPress={handleMarkFinished} style={styles.button}>
                Mark as finished
              </Button>
              <Button mode="outlined" onPress={handleMarkDnf} style={styles.button}>
                Mark as DNF
              </Button>
            </>
          )}

          {(item.status === 'finished' || item.status === 'DNF') && (
            <Button
              mode="outlined"
              onPress={() => handleMoveToStatus('to-read')}
              style={styles.button}
            >
              Move back to to-read
            </Button>
          )}

          <Button mode="outlined" onPress={confirmDelete} style={styles.deleteButton}>
            Delete from library
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  description: {
    marginBottom: 8,
  },
  descriptionMuted: {
    marginBottom: 8,
    opacity: 0.7,
  },
  moods: {
    marginTop: 8,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 4,
    fontWeight: '500',
  },
  moodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moodChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  progressInput: {
    marginTop: 8,
    maxWidth: 160,
  },
  metaText: {
    marginTop: 4,
  },
  metaLabel: {
    fontWeight: '600',
  },
  metaBlock: {
    marginTop: 8,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    marginTop: 24,
  },
  button: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 16,
  },
});

export default ReadableDetailScreen;
