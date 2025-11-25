// src/features/suggestions/hooks/useSuggestionEngine.ts
import { useQuery } from '@tanstack/react-query';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import { useMoodStore } from '@src/store/useMoodStore';
import { useSuggestionPrefsStore } from '@src/store/useSuggestionPrefsStore';
import { useUiStore, type SuggestionResult } from '@src/store/useUiStore';
import {
  runSuggestionEngine,
  type SuggestionContext,
} from '@src/features/suggestions/services/suggestionEngine';
import type { ReadableItem } from '@src/features/readables/types';

/**
 * Hook that wires together:
 * - the readables repository (SQLite)
 * - mood + filter stores
 * - pure suggestion engine
 * - UI store for lastSuggestion
 *
 * Important: no store writes during render/mount. All mutation happens
 * in the getSuggestion event handler.
 */
export const useSuggestionEngine = () => {
  // Selected mood tags from store
  const selectedMoodTags = useMoodStore((state) => state.selectedTags);

  // Suggestion filter preferences
  const prefs = useSuggestionPrefsStore((state) => ({
    includeBooks: state.includeBooks,
    includeFanfic: state.includeFanfic,
    minWordCount: state.minWordCount,
    maxWordCount: state.maxWordCount,
  }));

  // UI store: read & write lastSuggestion separately (keeps TS happy)
  const lastSuggestion = useUiStore((state) => state.lastSuggestion);
  const setLastSuggestion = useUiStore((state) => state.setLastSuggestion);

  // Load all "to-read" items
  const query = useQuery<ReadableItem[]>({
    queryKey: ['readables', 'to-read'],
    queryFn: () => readableRepository.getAllToRead(),
  });

  const getSuggestion = async (): Promise<SuggestionResult | null> => {
    // Refetch to work with fresh data
    const { data } = await query.refetch();
    const items = data ?? [];

    const context: SuggestionContext = {
      moodTags: selectedMoodTags,
      filters: {
        includeBooks: prefs.includeBooks,
        includeFanfic: prefs.includeFanfic,
        minWordCount: prefs.minWordCount ?? undefined,
        maxWordCount: prefs.maxWordCount ?? undefined,
      },
    };

    const result = runSuggestionEngine(items, context);
    setLastSuggestion(result ?? null);
    return result;
  };

  return {
    getSuggestion,
    isLoading: query.isFetching && !query.data,
    lastSuggestion,
  };
};
