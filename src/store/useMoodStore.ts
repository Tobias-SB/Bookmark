// src/store/useMoodStore.ts
import { create } from 'zustand';
import type { MoodTag, MoodProfile } from '@src/features/moods/types';

export interface MoodStoreState {
  selectedTags: MoodTag[];
  currentProfile: MoodProfile | null;
  setSelectedTags: (tags: MoodTag[]) => void;
  toggleTag: (tag: MoodTag) => void;
  clearTags: () => void;
  setCurrentProfile: (profile: MoodProfile | null) => void;
}

export const useMoodStore = create<MoodStoreState>((set) => ({
  selectedTags: [],
  currentProfile: null,

  setSelectedTags: (tags) => set({ selectedTags: tags }),

  toggleTag: (tag) =>
    set((state) =>
      state.selectedTags.includes(tag)
        ? { selectedTags: state.selectedTags.filter((t) => t !== tag) }
        : { selectedTags: [...state.selectedTags, tag] },
    ),

  clearTags: () => set({ selectedTags: [] }),

  setCurrentProfile: (profile) => set({ currentProfile: profile }),
}));
