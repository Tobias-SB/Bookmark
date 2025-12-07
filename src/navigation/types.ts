import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ReadableItem } from '@src/features/readables/types';

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

export type RootStackParamList = {
  RootTabs: NavigatorScreenParams<MainTabsParamList>;
  QuickAddReadable: undefined;
  ReadableDetail: { id: string };
  EditReadable: {
    id?: string;
    draft?: Partial<ReadableItem>;
  };
};
