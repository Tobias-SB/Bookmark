// src/features/moods/screens/MoodSelectScreen.tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button, Switch } from 'react-native-paper';
import Screen from '@src/components/common/Screen';
import { type MoodTag } from '../types';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import {
  runSuggestionEngine,
  type SuggestionContext,
} from '@src/features/suggestions/services/suggestionEngine';
import type { SuggestionResult } from '@src/store/useUiStore';
import SuggestionResultCard from '@src/features/suggestions/components/SuggestionResultCard';
import MoodTagSelector from '../components/MoodTagSelector';

const MoodSelectScreen: React.FC = () => {
  // Local-only state (no Zustand here)
  const [selectedTags, setSelectedTags] = useState<MoodTag[]>([]);
  const [includeBooks, setIncludeBooks] = useState<boolean>(true);
  const [includeFanfic, setIncludeFanfic] = useState<boolean>(true);

  // Your engine already supports these, but we keep them undefined in the UI for now
  const [minWordCount] = useState<number | undefined>(undefined);
  const [maxWordCount] = useState<number | undefined>(undefined);

  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState<SuggestionResult | null>(null);

  const handleSuggest = async () => {
    try {
      setIsLoadingSuggestion(true);

      const items = await readableRepository.getAllToRead();

      const context: SuggestionContext = {
        moodTags: selectedTags,
        filters: {
          includeBooks,
          includeFanfic,
          minWordCount,
          maxWordCount,
        },
      };

      const result = runSuggestionEngine(items, context);
      setLastSuggestion(result ?? null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to generate suggestion', error);
      setLastSuggestion(null);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          How do you want to feel?
        </Text>

        <View style={styles.moodSection}>
          <MoodTagSelector
            selected={selectedTags}
            onChange={setSelectedTags}
            title="Mood tags"
            showClearButton
          />
        </View>

        <View style={styles.filtersSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Filters
          </Text>
          <View style={styles.filterRow}>
            <Text>Include books</Text>
            <Switch value={includeBooks} onValueChange={setIncludeBooks} />
          </View>
          <View style={styles.filterRow}>
            <Text>Include fanfic</Text>
            <Switch value={includeFanfic} onValueChange={setIncludeFanfic} />
          </View>
        </View>

        <View style={styles.suggestSection}>
          <Button
            mode="contained"
            onPress={handleSuggest}
            loading={isLoadingSuggestion}
            disabled={isLoadingSuggestion}
          >
            Suggest something to read
          </Button>
        </View>

        {lastSuggestion && (
          <View style={styles.resultSection}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Suggested for you
            </Text>
            <SuggestionResultCard result={lastSuggestion} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  title: {
    marginBottom: 12,
  },
  moodSection: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  filtersSection: {
    marginTop: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  suggestSection: {
    marginTop: 24,
  },
  resultSection: {
    marginTop: 24,
  },
});

export default MoodSelectScreen;
