// src/app/navigation/types.ts
// §7 — All route param types. Imported by all navigators and screens — never defined inline.

import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Library: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  ReadableDetail: { id: string };
  AddEditReadable: { id?: string };
};
