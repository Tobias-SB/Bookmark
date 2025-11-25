// src/store/useSuggestionPrefsStore.ts
import { create } from 'zustand';

export interface SuggestionPrefsState {
  includeBooks: boolean;
  includeFanfic: boolean;
  minWordCount: number | null;
  maxWordCount: number | null;
  setIncludeBooks: (value: boolean) => void;
  setIncludeFanfic: (value: boolean) => void;
  setMinWordCount: (value: number | null) => void;
  setMaxWordCount: (value: number | null) => void;
  reset: () => void;
}

export const useSuggestionPrefsStore = create<SuggestionPrefsState>((set) => ({
  includeBooks: true,
  includeFanfic: true,
  minWordCount: null,
  maxWordCount: null,

  setIncludeBooks: (value) => set({ includeBooks: value }),
  setIncludeFanfic: (value) => set({ includeFanfic: value }),
  setMinWordCount: (value) => set({ minWordCount: value }),
  setMaxWordCount: (value) => set({ maxWordCount: value }),

  reset: () =>
    set({
      includeBooks: true,
      includeFanfic: true,
      minWordCount: null,
      maxWordCount: null,
    }),
}));
