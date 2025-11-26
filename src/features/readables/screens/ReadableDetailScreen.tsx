// src/features/readables/screens/ReadableDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Linking, Alert } from 'react-native';
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
import { READABLE_STATUS_LABELS, type ReadableStatus } from '@src/features/readables/types';

type DetailRoute = RouteProp<RootStackParamList, 'ReadableDetail'>;
type RootNav = NavigationProp<RootStackParamList>;

const ReadableDetailScreen: React.FC = () => {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<RootNav>();
  const { id } = route.params;
  const { data, isLoading, isError, refetch } = useReadableById(id);
  const queryClient = useQueryClient();

  const [progressDraft, setProgressDraft] = useState<number>(0);

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
        // In a real app, show a toast/snackbar here.
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

  return (
    <Screen>
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

      {item.type === 'fanfic' ? (
        <View style={styles.section}>
          {item.wordCount != null ? (
            <Text>Word count: {item.wordCount.toLocaleString()}</Text>
          ) : null}
          {item.rating ? <Text>Rating: {item.rating}</Text> : null}
          {item.complete != null ? <Text>Complete: {item.complete ? 'Yes' : 'No'}</Text> : null}
          <Button mode="contained-tonal" style={styles.button} onPress={handleOpenAo3}>
            Open on AO3
          </Button>
        </View>
      ) : null}

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
            <Button mode="text" onPress={handleMarkDnf} style={styles.button}>
              Mark as DNF
            </Button>
          </>
        )}

        {(item.status === 'finished' || item.status === 'DNF') && (
          <Button mode="text" onPress={() => handleMoveToStatus('to-read')} style={styles.button}>
            Move back to to-read
          </Button>
        )}

        <Button mode="outlined" onPress={confirmDelete} style={styles.deleteButton}>
          Delete from library
        </Button>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
