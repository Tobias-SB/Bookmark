// src/features/readables/types.libraryFilters.ts
import type { MoodTag } from '../../../db/schema/moods.schema';
import type { LibraryFilter, ReadableType, Ao3Rating } from '../types';

/**
 * Filter for "work state" from the user's perspective.
 * This is distinct from ReadableStatus:
 * - 'complete'  → fully completed works
 * - 'wip'       → not completed / still in progress
 */
export type WorkStateFilter = 'all' | 'complete' | 'wip';

/**
 * Filter for AO3-style ratings.
 * 'all' means "do not filter by rating".
 */
export type RatingFilter = 'all' | Ao3Rating;

/**
 * Fields the library list can be sorted by.
 * You can extend this as needed; all consumers should use this union
 * instead of hard-coded strings.
 */
export type LibrarySortField =
  | 'title'
  | 'author'
  | 'createdAt'
  | 'updatedAt'
  | 'priority'
  | 'progressPercent';

/**
 * Sort direction for the library list.
 */
export type LibrarySortDirection = 'asc' | 'desc';

/**
 * Canonical representation of the library filters + sort.
 * This is the state we want Smart Shelves to capture and re-apply.
 *
 * IMPORTANT:
 * - `status` uses the existing LibraryFilter type ('all' | ReadableStatus)
 * - `type` allows 'all' to represent "any readable type"
 *
 * NOTE:
 * - Priority is *not* a filter here; it only exists as a sort field.
 *   UX-wise: "show everything, but sort by priority" instead of
 *   "only show priority = X".
 */
export interface LibraryFilterState {
  /** Free-text search; empty string means "no search" */
  searchQuery: string;

  /** 'all' or a specific status like 'to-read', 'reading', 'finished', 'DNF' */
  status: LibraryFilter;

  /** 'all' or a specific type ('book' | 'fanfic') */
  type: 'all' | ReadableType;

  /** 'all' or an AO3 rating (G/T/M/E/NR) */
  rating: RatingFilter;

  /** 'all' | 'complete' | 'wip' */
  workState: WorkStateFilter;

  /**
   * Mood tags applied as a filter.
   * Semantics: ANY-match (if non-empty, a readable must have at least
   * one of these moods to be included).
   */
  moodTags: MoodTag[];

  /** Field used for sorting the library list */
  sortField: LibrarySortField;

  /** Sort direction (ascending or descending) */
  sortDirection: LibrarySortDirection;
}

/**
 * Default filter state used when opening the Library or when
 * the user selects the built-in "All" shelf.
 */
export const DEFAULT_LIBRARY_FILTER_STATE: LibraryFilterState = {
  searchQuery: '',
  status: 'all',
  type: 'all',
  rating: 'all',
  workState: 'all',
  moodTags: [],
  sortField: 'updatedAt',
  sortDirection: 'desc',
};

/**
 * Helper to check if a LibraryFilterState is effectively "default".
 * This is handy for:
 * - deciding when to show "Clear filters"
 * - knowing if the user has diverged from the "All" shelf
 */
export function isDefaultLibraryFilterState(state: LibraryFilterState): boolean {
  const def = DEFAULT_LIBRARY_FILTER_STATE;

  if (state.searchQuery.trim() !== def.searchQuery) return false;
  if (state.status !== def.status) return false;
  if (state.type !== def.type) return false;
  if (state.rating !== def.rating) return false;
  if (state.workState !== def.workState) return false;
  if (state.sortField !== def.sortField) return false;
  if (state.sortDirection !== def.sortDirection) return false;

  // Compare moodTags by id if needed; for now we just require
  // both arrays to be empty to be considered "default".
  if (state.moodTags.length !== 0) return false;

  return true;
}
