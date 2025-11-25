// src/__tests__/suggestionEngine.test.ts
import {
  getSuggestionFromList,
  scoreReadable,
} from '@src/features/suggestions/services/suggestionEngine';
import type { ReadableItem } from '@src/features/readables/types';
import type { MoodTag } from '@src/features/moods/types';

describe('suggestionEngine', () => {
  const baseBook: ReadableItem = {
    id: '1',
    type: 'book',
    title: 'Cozy Mystery',
    author: 'Author A',
    description: 'A cozy little mystery.',
    status: 'to-read',
    priority: 3,
    moodTags: ['cozy', 'mysterious'] as MoodTag[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'manual',
    sourceId: null,
    pageCount: 300,
    genres: ['mystery'],
  };

  const baseFanfic: ReadableItem = {
    id: '2',
    type: 'fanfic',
    title: 'Epic Space Fic',
    author: 'Author B',
    description: 'Epic sci-fi adventure.',
    status: 'to-read',
    priority: 5,
    moodTags: ['epic'] as MoodTag[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'ao3',
    ao3WorkId: '12345',
    ao3Url: 'https://archiveofourown.org/works/12345',
    fandoms: ['Original'],
    relationships: [],
    characters: [],
    ao3Tags: [],
    rating: 'T',
    warnings: [],
    chapterCount: 10,
    complete: false,
    wordCount: 80000,
  };

  it('scores mood overlap positively', () => {
    const context = {
      moodTags: ['cozy'] as MoodTag[],
      prefs: {
        includeBooks: true,
        includeFanfic: true,
        minWordCount: null,
        maxWordCount: null,
      },
    };

    const scored = scoreReadable(baseBook, context);
    expect(scored).not.toBeNull();
    expect((scored as { score: number }).score).toBeGreaterThan(0);
  });

  it('filters by type preferences', () => {
    const context = {
      moodTags: ['epic'] as MoodTag[],
      prefs: {
        includeBooks: false,
        includeFanfic: true,
        minWordCount: null,
        maxWordCount: null,
      },
    };

    const suggestion = getSuggestionFromList([baseBook, baseFanfic], context);

    expect(suggestion).not.toBeNull();
    if (suggestion) {
      expect(suggestion.item.type).toBe('fanfic');
    }
  });

  it('returns null when no items match', () => {
    const context = {
      moodTags: ['cozy'] as MoodTag[],
      prefs: {
        includeBooks: false,
        includeFanfic: false,
        minWordCount: null,
        maxWordCount: null,
      },
    };

    const suggestion = getSuggestionFromList([baseBook, baseFanfic], context);

    expect(suggestion).toBeNull();
  });
});
