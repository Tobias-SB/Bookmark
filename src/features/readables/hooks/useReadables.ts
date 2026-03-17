// src/features/readables/hooks/useReadables.ts
// §8, §12, §13 — Fetches all readables from the repository, then applies
// ReadableFilters entirely in JavaScript.
// No filter params are passed to the repository — listReadables always returns
// all rows. Filtering and sorting live here, not in SQLite.
//
// Filter logic:
//   - kind: exact match. Absent = show all kinds.
//   - status: OR logic across the array. Absent/empty = show all.
//   - isComplete: exact match. Books always have isComplete = null so they
//     never match an active isComplete filter — no special-case needed.
//   - isAbandoned: exact match.
//   - fandom: case-insensitive exact match against any entry in fandom[].
//   - rating: OR logic across selected ratings.
//   - seriesOnly: show only readables with a non-null seriesName.
//   - includeTags: AND logic — readable must have ALL listed tags.
//   - excludeTags: readable must have NONE of the listed tags.
//   - search: case-insensitive partial match on title and author (OR).
//   - Multiple active filters use AND logic across filter types.
// Default sort: dateAdded descending.
// Numeric sorts (wordCount, totalUnits): nulls always last.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Readable, ReadableFilters } from '../domain/readable';
import { readableKeys } from '../domain/queryKeys';
import { listReadables } from '../data/readableRepository';

// ── Filter + sort ─────────────────────────────────────────────────────────────

export function applyFilters(readables: Readable[], filters: ReadableFilters): Readable[] {
  let result = readables;

  // Kind filter
  if (filters.kind !== undefined) {
    result = result.filter((r) => r.kind === filters.kind);
  }

  // Status filter — OR logic across selected statuses
  if (filters.status !== undefined && filters.status.length > 0) {
    result = result.filter((r) => filters.status!.includes(r.status));
  }

  // isComplete filter — books have isComplete = null, so they never match
  // a defined isComplete value. AND logic with other filters is automatic.
  if (filters.isComplete !== undefined) {
    result = result.filter((r) => r.isComplete === filters.isComplete);
  }

  // isAbandoned filter
  if (filters.isAbandoned !== undefined) {
    result = result.filter((r) => r.isAbandoned === filters.isAbandoned);
  }

  // Fandom filter — case-insensitive exact match against any entry in fandom[]
  if (filters.fandom !== undefined) {
    const fandomLower = filters.fandom.toLowerCase();
    result = result.filter((r) =>
      r.fandom.some((f) => f.toLowerCase() === fandomLower),
    );
  }

  // Rating filter — OR logic across selected ratings
  if (filters.rating !== undefined && filters.rating.length > 0) {
    result = result.filter(
      (r) => r.rating !== null && filters.rating!.includes(r.rating),
    );
  }

  // seriesOnly — show only readables with a non-null seriesName
  if (filters.seriesOnly === true) {
    result = result.filter((r) => r.seriesName !== null);
  }

  // includeTags — AND logic: readable must have ALL of these tags
  if (filters.includeTags !== undefined && filters.includeTags.length > 0) {
    result = result.filter((r) =>
      filters.includeTags!.every((tag) => r.tags.includes(tag)),
    );
  }

  // excludeTags — readable must have NONE of these tags
  if (filters.excludeTags !== undefined && filters.excludeTags.length > 0) {
    result = result.filter((r) =>
      filters.excludeTags!.every((tag) => !r.tags.includes(tag)),
    );
  }

  // Search — case-insensitive partial match on title OR author
  if (filters.search !== undefined && filters.search.trim() !== '') {
    const term = filters.search.trim().toLowerCase();
    result = result.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        (r.author?.toLowerCase().includes(term) ?? false),
    );
  }

  // Sort — ISO 8601 strings sort correctly lexicographically for date fields.
  // Numeric sorts (wordCount, totalUnits): nulls always last regardless of order.
  const sortBy = filters.sortBy ?? 'dateAdded';
  const sortOrder = filters.sortOrder ?? 'desc';

  const sorted = [...result].sort((a, b) => {
    let cmp: number;
    if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy === 'wordCount' || sortBy === 'totalUnits') {
      const aVal = sortBy === 'wordCount' ? a.wordCount : a.totalUnits;
      const bVal = sortBy === 'wordCount' ? b.wordCount : b.totalUnits;
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;  // null always last
      if (bVal === null) return -1; // null always last
      cmp = aVal - bVal;
    } else {
      const aVal = sortBy === 'dateAdded' ? a.dateAdded : a.dateUpdated;
      const bVal = sortBy === 'dateAdded' ? b.dateAdded : b.dateUpdated;
      cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  return sorted;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseReadablesResult {
  readables: Readable[];
  isLoading: boolean;
  isError: boolean;
  error: AppError | null;
  /** Call to retry a failed query. Safe to call as fire-and-forget. */
  refetch: () => void;
}

/**
 * Returns all readables after applying the given filters and sort order.
 * Defaults to { sortBy: 'dateAdded', sortOrder: 'desc' } with no active filters.
 */
export function useReadables(filters: ReadableFilters = {}): UseReadablesResult {
  const db = useDatabase();

  const { data, isLoading, isError, error, refetch } = useQuery<Readable[], AppError>({
    queryKey: readableKeys.list(filters),
    queryFn: () => listReadables(db),
    select: (all) => applyFilters(all, filters),
  });

  return {
    readables: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => { void refetch(); },
  };
}
