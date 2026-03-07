// src/features/readables/hooks/useReadables.ts
// §8, §12, §13 — Fetches all readables from the repository, then applies
// ReadableFilters (search, status, isComplete, sort) entirely in JavaScript.
// No filter params are passed to the repository — listReadables always returns
// all rows. Filtering and sorting live here, not in SQLite.
//
// Filter logic:
//   - status: exact match. Absent = no status filter.
//   - isComplete: exact match. Books always have isComplete = null so they
//     never match an active isComplete filter — no special-case needed.
//   - search: case-insensitive partial match on title and author (OR).
//   - Multiple active filters use AND logic.
// Default sort: dateAdded descending.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Readable, ReadableFilters } from '../domain/readable';
import { readableKeys } from '../domain/queryKeys';
import { listReadables } from '../data/readableRepository';

// ── Filter + sort ─────────────────────────────────────────────────────────────

function applyFilters(readables: Readable[], filters: ReadableFilters): Readable[] {
  let result = readables;

  // Status filter
  if (filters.status !== undefined) {
    result = result.filter((r) => r.status === filters.status);
  }

  // isComplete filter — books have isComplete = null, so they never match
  // a defined isComplete value. AND logic with status is automatic.
  if (filters.isComplete !== undefined) {
    result = result.filter((r) => r.isComplete === filters.isComplete);
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

  // Sort — ISO 8601 strings sort correctly lexicographically for date fields
  const sortBy = filters.sortBy ?? 'dateAdded';
  const sortOrder = filters.sortOrder ?? 'desc';

  const sorted = [...result].sort((a, b) => {
    let cmp: number;
    if (sortBy === 'title') {
      cmp = a.title.localeCompare(b.title);
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
}

/**
 * Returns all readables after applying the given filters and sort order.
 * Defaults to { sortBy: 'dateAdded', sortOrder: 'desc' } with no active filters.
 */
export function useReadables(filters: ReadableFilters = {}): UseReadablesResult {
  const db = useDatabase();

  const { data, isLoading, isError, error } = useQuery<Readable[], AppError>({
    queryKey: readableKeys.list(filters),
    queryFn: () => listReadables(db),
    select: (all) => applyFilters(all, filters),
  });

  return {
    readables: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
  };
}
