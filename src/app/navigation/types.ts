// src/app/navigation/types.ts
// §7 — All route param types. Imported by all navigators and screens — never defined inline.

import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Library: undefined;
  Settings: undefined;
};

/**
 * Prefill data passed from QuickAddScreen to AddEditScreen.
 * Always present in add mode (either from an import or from a manual skip).
 * sourceType = 'manual' means the user skipped import — no metadata fields will be set.
 */
export interface AddEditPrefill {
  kind: 'book' | 'fanfic';
  /** 'manual' when the user skipped import; 'ao3' or 'book_provider' after a successful import. */
  sourceType: 'ao3' | 'book_provider' | 'manual';
  sourceId: string | null;
  isbn: string | null;
  coverUrl: string | null;
  availableChapters: number | null;
  /** Populated when sourceType !== 'manual' and the import returned a value. */
  title?: string;
  author?: string | null;
  summary?: string | null;
  tags?: string[];
  progressTotal?: number | null;
  sourceUrl?: string | null;
  isComplete?: boolean | null;
}

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  ReadableDetail: { id: string };
  /** Quick add modal — first step when creating a new readable. Kind selected here. */
  QuickAddReadable: undefined;
  /**
   * Add/edit form. In add mode, prefill is always provided (either from an import
   * or a manual skip from QuickAddReadable). In edit mode, id is provided and prefill is absent.
   */
  AddEditReadable: { id?: string; prefill?: AddEditPrefill };
};
