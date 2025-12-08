// src/features/readables/types.libraryFilters.ts
import type { LibraryFilter, ReadableType, Ao3Rating } from '../types';
import type { MoodTag } from '@src/features/moods/types';

export type LibrarySortField =
  | 'createdAt'
  | 'updatedAt'
  | 'title'
  | 'author'
  | 'priority'
  | 'progressPercent';

export type LibrarySortDirection = 'asc' | 'desc';

export interface LibraryFilterState {
  /**
   * Legacy / spare string field.
   * We keep this around for backward-compat (old shelves, deep links),
   * but the main UX now uses `searchTerms` instead of a single query.
   */
  searchQuery: string;

  /**
   * Canonical multi-term search:
   * - Each term is added explicitly by the user (chip)
   * - Filter logic treats terms as AND: all must match the item.
   */
  searchTerms: string[];

  status: LibraryFilter;

  /**
   * 'all' shows everything, otherwise a single ReadableType.
   */
  type: 'all' | ReadableType;

  /**
   * 'all' = ignore rating, otherwise AO3 rating like 'G' | 'T' | 'M' | 'E' | 'NR'.
   */
  rating: 'all' | Ao3Rating;

  /**
   * Work completeness filter:
   * - 'all'      → ignore
   * - 'complete' → only completed items
   * - 'wip'      → only in-progress items
   */
  workState: 'all' | 'complete' | 'wip';

  /**
   * Mood tags currently applied as filters (ANY-match).
   */
  moodTags: MoodTag[];

  sortField: LibrarySortField;
  sortDirection: LibrarySortDirection;
}

export const DEFAULT_LIBRARY_FILTER_STATE: LibraryFilterState = {
  searchQuery: '',
  searchTerms: [],
  status: 'all',
  type: 'all',
  rating: 'all',
  workState: 'all',
  moodTags: [],
  sortField: 'createdAt',
  sortDirection: 'desc',
};

export function isDefaultLibraryFilterState(filter: LibraryFilterState): boolean {
  return (
    filter.searchQuery.trim() === '' &&
    filter.searchTerms.length === 0 &&
    filter.status === DEFAULT_LIBRARY_FILTER_STATE.status &&
    filter.type === DEFAULT_LIBRARY_FILTER_STATE.type &&
    filter.rating === DEFAULT_LIBRARY_FILTER_STATE.rating &&
    filter.workState === DEFAULT_LIBRARY_FILTER_STATE.workState &&
    filter.moodTags.length === 0 &&
    filter.sortField === DEFAULT_LIBRARY_FILTER_STATE.sortField &&
    filter.sortDirection === DEFAULT_LIBRARY_FILTER_STATE.sortDirection
  );
}
