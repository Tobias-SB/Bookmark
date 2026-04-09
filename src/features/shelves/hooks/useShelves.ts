// src/features/shelves/hooks/useShelves.ts
// Fetches all shelves from the repository.
// Sorting responsibility: the repository ORDER BY clause (sort_order ASC, date_created ASC)
// handles ordering. Unlike useReadables, no JS-layer sort is applied here — the data
// arrives pre-sorted and callers should not re-sort it.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Shelf } from '../domain/shelf';
import { shelfKeys } from '../domain/queryKeys';
import { listShelves } from '../data/shelfRepository';

export interface UseShelvesResult {
  shelves: Shelf[];
  isLoading: boolean;
  isError: boolean;
  error: AppError | null;
  refetch: () => void;
}

export function useShelves(): UseShelvesResult {
  const db = useDatabase();
  const { data, isLoading, isError, error, refetch } = useQuery<Shelf[], AppError>({
    queryKey: shelfKeys.lists(),
    queryFn: () => listShelves(db),
  });

  return {
    shelves: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => { void refetch(); },
  };
}
