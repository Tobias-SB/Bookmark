// src/features/readables/hooks/useLibraryReadables.ts
import { useMemo } from 'react';
import type { ReadableItem } from '@src/features/readables/types';
import { useReadables } from '@src/features/readables/hooks/useReadables';
import type { LibraryFilterState } from '@src/features/readables/types/libraryFilters';
import { filterAndSortReadables } from '@src/features/readables/services/libraryFilterService';

export interface UseLibraryReadablesResult {
  items: ReadableItem[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isRefetching: boolean;
}

/**
 * Canonical hook for the Library screen (and any future "view all" screens).
 *
 * Responsibilities:
 * - Reuse the existing `useReadables` hook to fetch ALL readables once.
 * - Apply the pure filter/sort "brain" (filterAndSortReadables) in JS.
 * - Expose a simple { items, isLoading, isError, error, refetch, isRefetching } shape.
 */
export function useLibraryReadables(filter: LibraryFilterState): UseLibraryReadablesResult {
  const {
    data: allReadables = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useReadables();

  const items = useMemo<ReadableItem[]>(
    () => filterAndSortReadables(allReadables, filter),
    [allReadables, filter],
  );

  return {
    items,
    isLoading,
    isError,
    error,
    // RefreshControl doesn't care about the returned promise,
    // so we can safely ignore it here.
    refetch: () => {
      void refetch();
    },
    isRefetching,
  };
}
