// src/features/readables/screens/ReadableDetailScreen.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Linking, Alert, ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Chip, Text, Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@src/components/common/Screen';
import LoadingState from '@src/components/common/LoadingState';
import ErrorState from '@src/components/common/ErrorState';
import { useReadableById } from '../hooks/useReadableById';
import type { RootStackParamList } from '@src/navigation/types';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import {
  READABLE_STATUS_LABELS,
  type FanficReadable,
  type BookReadable,
  type ProgressMode,
} from '@src/features/readables/types';
import ReadingProgressSection from '../components/ReadingProgressSection';
import FanficMetadataSection from '../components/FanficMetadataSection';

type DetailRoute = RouteProp<RootStackParamList, 'ReadableDetail'>;
type RootNav = NavigationProp<RootStackParamList>;

const ReadableDetailScreen: React.FC = () => {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<RootNav>();
  const { id } = route.params;

  const { data, isLoading, isError, refetch } = useReadableById(id);
  const queryClient = useQueryClient();

  const [tagsExpanded, setTagsExpanded] = useState<boolean>(false);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [notesDraft, setNotesDraft] = useState<string>('');

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

  const handleChangeProgressMode = async (mode: ProgressMode) => {
    try {
      // ✅ IMPORTANT: do NOT rewrite the whole readable just to change one field.
      // That can wipe normalized/optional fields and cause "nothing loads" symptoms.
      await readableRepository.updateProgressMode(item.id, mode);

      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update progress mode', e);
    }
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

  const handleSaveUnit = async (unit: number) => {
    try {
      await readableRepository.updateProgressByUnits({
        id: item.id,
        type: item.type,
        currentUnit: unit,
      });
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update unit-based progress', e);
    }
  };

  const handleSavePercent = async (percent: number) => {
    try {
      await readableRepository.updateProgress(item.id, percent);
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update percent-based progress', e);
    }
  };

  const handleSaveTime = async (payload: { currentSeconds: number; totalSeconds: number }) => {
    try {
      await readableRepository.updateProgressByTime({
        id: item.id,
        currentSeconds: payload.currentSeconds,
        totalSeconds: payload.totalSeconds,
      });
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update time-based progress', e);
    }
  };

  const handleMarkFinished = async () => {
    try {
      await readableRepository.updateStatus(item.id, 'finished');
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark as finished', e);
    }
  };

  const handleMarkDnf = async () => {
    try {
      await readableRepository.updateStatus(item.id, 'DNF');
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark as DNF', e);
    }
  };

  const handleMoveBackToToRead = async () => {
    try {
      await readableRepository.updateStatus(item.id, 'to-read');
      await invalidateReadablesAndStats();
      await refetch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to move back to to-read', e);
    }
  };

  const handleDelete = async () => {
    try {
      await readableRepository.delete(item.id);
      await invalidateReadablesAndStats();
      navigation.goBack();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete readable', e);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete from library',
      'Are you sure you want to remove this readable from your library?',
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

  const handleTagPress = (label: string) => {
    navigation.navigate('RootTabs', {
      screen: 'Library',
      params: {
        initialQuery: {
          tagLabel: label,
        },
      },
    });
  };

  const handleStartEditNotes = () => {
    setNotesDraft(item.notes ?? '');
    setIsEditingNotes(true);
  };

  const handleCancelEditNotes = () => {
    setIsEditingNotes(false);
  };

  const handleSaveNotes = async () => {
    try {
      const trimmed = notesDraft.trim();
      const notesToSave = trimmed.length > 0 ? trimmed : null;
      await readableRepository.updateNotes(item.id, notesToSave);
      await invalidateReadablesAndStats();
      await refetch();
      setIsEditingNotes(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to save notes', e);
    }
  };

  const isFanfic = item.type === 'fanfic';
  const isBook = item.type === 'book';
  const fanfic = isFanfic ? (item as FanficReadable) : null;
  const book = isBook ? (item as BookReadable) : null;

  const notesTitle: string =
    item.status === 'DNF' ? 'DNF notes' : item.status === 'finished' ? 'Review / notes' : 'Notes';

  const totalPages = book?.pageCount ?? null;
  const currentPage = book?.currentPage ?? null;

  let availableChapters: number | null = fanfic?.availableChapters ?? null;
  let totalChapters: number | null = fanfic?.totalChapters ?? null;
  const currentChapter = fanfic?.currentChapter ?? null;

  if (availableChapters == null && totalChapters == null && fanfic?.chapterCount != null) {
    availableChapters = fanfic.chapterCount;
  }

  if (fanfic?.complete && availableChapters != null && totalChapters == null) {
    totalChapters = availableChapters;
  }

  const chaptersLeft = availableChapters != null ? String(availableChapters) : '?';
  const chaptersRight = totalChapters != null ? String(totalChapters) : '?';
  const chaptersDisplay =
    availableChapters != null || totalChapters != null ? `${chaptersLeft}/${chaptersRight}` : null;

  let chapterStatusLabel: string | null = null;
  if (fanfic) {
    if (fanfic.complete === true) {
      chapterStatusLabel = 'Complete';
    } else {
      if (chaptersDisplay) {
        chapterStatusLabel = 'Work in Progress';
      }
    }
  }

  const unitLabel = isBook ? 'page' : 'chapter';
  const currentUnit = isBook ? (currentPage ?? null) : (currentChapter ?? null);
  const maxUnit = isBook ? (totalPages ?? null) : (totalChapters ?? availableChapters ?? null);

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

        {isBook && (
          <View style={styles.metaBlock}>
            {totalPages != null && (
              <Text>
                Pages: {currentPage != null ? `${currentPage} / ` : ''}
                {totalPages}
              </Text>
            )}
            {currentPage != null && totalPages == null && <Text>Current page: {currentPage}</Text>}
          </View>
        )}

        {isFanfic && (
          <View style={styles.metaBlock}>
            {chaptersDisplay && (
              <Text>
                Chapters: {chaptersDisplay}
                {chapterStatusLabel ? ` • ${chapterStatusLabel}` : ''}
              </Text>
            )}
            {currentChapter != null && <Text>Current chapter: {currentChapter}</Text>}
          </View>
        )}

        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : (
          <Text style={styles.descriptionMuted}>No description.</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading progress</Text>
          <ReadingProgressSection
            status={item.status}
            type={item.type}
            progressMode={item.progressMode}
            onChangeProgressMode={handleChangeProgressMode}
            currentPercent={item.progressPercent}
            currentUnit={currentUnit}
            maxUnit={maxUnit}
            unitLabel={unitLabel}
            onSaveUnit={handleSaveUnit}
            onSavePercent={handleSavePercent}
            onSaveTime={handleSaveTime}
            timeCurrentSeconds={item.timeCurrentSeconds ?? null}
            timeTotalSeconds={item.timeTotalSeconds ?? null}
          />
        </View>

        {item.moodTags.length > 0 ? (
          <View style={styles.moods}>
            <Text style={styles.sectionTitle}>Mood tags</Text>
            <View style={styles.moodChips}>
              {item.moodTags.map((tag) => {
                const label = typeof tag === 'string' ? tag.replace('-', ' ') : String(tag);
                return (
                  <Chip key={label} style={styles.moodChip} onPress={() => handleTagPress(label)}>
                    {label}
                  </Chip>
                );
              })}
            </View>
          </View>
        ) : null}

        {item.type === 'fanfic' && (
          <FanficMetadataSection
            fanfic={item as FanficReadable}
            tagsExpanded={tagsExpanded}
            onToggleTags={() => setTagsExpanded((prev) => !prev)}
            onOpenAo3={handleOpenAo3}
            onTagPress={handleTagPress}
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{notesTitle}</Text>
          {item.notes ? (
            <>
              <Text style={styles.notesText}>{item.notes}</Text>
              <Button mode="text" onPress={handleStartEditNotes} style={styles.notesButton}>
                Edit notes
              </Button>
            </>
          ) : (
            <Button mode="outlined" onPress={handleStartEditNotes} style={styles.notesButton}>
              Add notes
            </Button>
          )}
        </View>

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
            <Button mode="outlined" onPress={handleMoveBackToToRead} style={styles.button}>
              Move back to to-read
            </Button>
          )}

          <Button mode="outlined" onPress={confirmDelete} style={styles.deleteButton}>
            Delete from library
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={isEditingNotes} onDismiss={handleCancelEditNotes}>
          <Dialog.Title>{notesTitle}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder={
                item.status === 'DNF'
                  ? 'Why did you DNF this? (optional)'
                  : 'Write your thoughts, review, or notes…'
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelEditNotes}>Cancel</Button>
            <Button onPress={handleSaveNotes}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  metaBlock: {
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
  notesText: {
    marginTop: 4,
  },
  notesButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
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
