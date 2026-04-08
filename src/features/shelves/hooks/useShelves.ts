// src/features/shelves/hooks/useShelves.ts
// Fetches all shelves from the repository.
// Sorting is done in JS (by sort_order ASC) — the repository already orders them.

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
