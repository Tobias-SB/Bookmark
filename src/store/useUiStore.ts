// src/store/useUiStore.ts
import { create } from 'zustand';
import type { ReadableItem } from '@src/features/readables/types';

export interface SuggestionResult {
  item: ReadableItem;
  score: number;
  reason: string;
}

interface UiState {
  lastSuggestion: SuggestionResult | null;
  isLoadingSuggestion: boolean;
  setLastSuggestion: (result: SuggestionResult | null) => void;
  setIsLoadingSuggestion: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  lastSuggestion: null,
  isLoadingSuggestion: false,

  setLastSuggestion: (result) => set({ lastSuggestion: result }),
  setIsLoadingSuggestion: (value) => set({ isLoadingSuggestion: value }),
}));
