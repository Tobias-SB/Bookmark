// src/navigation/types.ts
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type MainTabsParamList = {
  Library: undefined;
  Discover: undefined;
  Stats: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  RootTabs: NavigatorScreenParams<MainTabsParamList>;
  ReadableDetail: { id: string };
  EditReadable: { id?: string };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Screen
>;

export type MainTabsScreenProps<Screen extends keyof MainTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, Screen>,
  RootStackScreenProps<keyof RootStackParamList>
>;
