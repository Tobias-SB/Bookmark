// src/features/readables/types/libraryQuery.ts
import type { LibraryFilter, ReadableType } from '../types';

export type LibrarySortField =
  | 'createdAt'
  | 'updatedAt'
  | 'title'
  | 'author'
  | 'priority'
  | 'progressPercent';

export type SortDirection = 'asc' | 'desc';

export interface LibrarySort {
  field: LibrarySortField;
  direction: SortDirection;
}

/**
 * Query parameters that represent how the user wants
 * to filter and sort the Library.
 *
 * UI-facing, not DB-specific.
 */
export interface LibraryQueryParams {
  status: LibraryFilter;
  /**
   * Optional single type filter:
   * - 'book' shows only books
   * - 'fanfic' shows only fanfic
   * - undefined shows all types
   */
  type?: ReadableType;
  minPriority?: number;
  maxPriority?: number;
  searchQuery?: string | null;
  sort: LibrarySort;
}

/**
 * Parameters passed into the Library screen via navigation
 * when we deep-link from somewhere else (e.g. tag tap).
 */
export interface LibraryInitialQueryParams {
  searchQuery?: string | null;
  tagLabel?: string | null;
}
