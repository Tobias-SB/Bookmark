// src/features/readables/screens/ReadableDetailScreen.tsx
import React from 'react';
import { StyleSheet, View, Linking } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Chip, Text, Button } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import { readableRepository } from '@src/features/readables/services/readableRepository';

type DetailRoute = RouteProp<RootStackParamList, 'ReadableDetail'>;
type RootNav = NavigationProp<RootStackParamList>;

const ReadableDetailScreen: React.FC = () => {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<RootNav>();
  const { id } = route.params;
  const { data, isLoading, isError, refetch } = useReadableById(id);

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

  const handleMarkFinished = async () => {
    try {
      // We treat `completed` + `updatedAt` as "finished at".
      await readableRepository.updateStatus(item.id, 'finished');
      navigation.goBack();
    } catch (e) {
      // You could show an error state/snackbar here if you like.
      console.error('Failed to mark as finished', e);
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
        <Chip style={styles.chip}>Status: {item.status}</Chip>
      </View>

      {item.description ? (
        <Text style={styles.description}>{item.description}</Text>
      ) : (
        <Text style={styles.descriptionMuted}>No description.</Text>
      )}

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
        <Button mode="text" onPress={handleMarkFinished} style={styles.button}>
          Mark as finished
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
  footer: {
    marginTop: 24,
  },
  button: {
    marginTop: 8,
  },
});

export default ReadableDetailScreen;
