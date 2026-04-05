// src/app/navigation/types.ts
// §7 — All route param types. Imported by all navigators and screens — never defined inline.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AO3Rating, AuthorType, ReadableFilters } from '../../features/readables/domain/readable';

export type TabParamList = {
  // Library accepts initialFilters so tappable tags on the detail screen
  // can deep-link into the library with a pre-applied tag filter.
  Library: { initialFilters?: ReadableFilters } | undefined;
  // Updates tab added in Phase 7 — declared here for typed navigation.
  Updates: undefined;
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
  totalUnits?: number | null;
  sourceUrl?: string | null;
  isComplete?: boolean | null;
  // v2 prefill fields:
  wordCount?: number | null;
  fandom?: string[];
  relationships?: string[];
  rating?: AO3Rating | null;
  archiveWarnings?: string[];
  seriesName?: string | null;
  seriesPart?: number | null;
  seriesTotal?: number | null;
  /** Import-only — written to repo on create, not a form field. */
  authorType?: AuthorType | null;
  /** Import-only — written to repo on create, not a form field. */
  publishedAt?: string | null;
  /** Import-only — written to repo on create, not a form field. */
  ao3UpdatedAt?: string | null;
  isAbandoned?: boolean;
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
  /** AO3 login modal — WebView pointing to archiveofourown.org/users/login. */
  Ao3Login: undefined;
};
