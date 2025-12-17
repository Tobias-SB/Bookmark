import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ReadableItem } from '@src/features/readables/types';
import type { MoodTag } from '@src/features/moods/types';

/**
 * Parameters passed into the Library screen via navigation
 * when we deep-link from somewhere else (e.g. tag tap).
 */
export interface LibraryInitialQueryParams {
  searchQuery?: string | null;
  tagLabel?: string | null;
}

export type MainTabsParamList = {
  Library: { initialQuery?: LibraryInitialQueryParams } | undefined;
  Discover: undefined;
  Stats: undefined;
  Settings: undefined;
};

/**
 * Navigation-safe subset of Book metadata candidate data.
 * Keep this JSON-serializable and decoupled from service-layer imports.
 */
export type BookMetadataNav = {
  title: string | null;
  authors: string[];
  pageCount: number | null;
  genres: string[];
  description: string | null;
  coverUrl: string | null;
};

export type BookMetadataCandidateNav = {
  id: string;
  score: number;
  titleScore: number;
  authorScore: number;
  metadata: BookMetadataNav;
};

export type RootStackParamList = {
  RootTabs: NavigatorScreenParams<MainTabsParamList>;
  QuickAddReadable: undefined;
  ReadableDetail: { id: string };
  EditReadable: {
    id?: string;
    draft?: Partial<ReadableItem>;
  };

  /**
   * Book picker screen when we have multiple plausible Open Library matches.
   */
  ChooseBookResult: {
    title: string;
    author: string;
    priority: number;
    moodTags: MoodTag[];
    mode: 'strict' | 'flexible';
    candidates: BookMetadataCandidateNav[];
  };
};
