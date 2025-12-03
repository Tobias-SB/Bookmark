// src/navigation/types.ts
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ReadableItem } from '@src/features/readables/types';
import type { LibraryInitialQueryParams } from '@src/features/readables/types/libraryQuery';

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
