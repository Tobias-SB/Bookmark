// src/features/shelves/hooks/useShelfReadables.ts
// Fetches the ShelfReadable membership records for a single shelf.
// The caller resolves readable IDs against the full readables list.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { ShelfReadable } from '../domain/shelf';
import { shelfKeys } from '../domain/queryKeys';
import { listShelfReadables } from '../data/shelfRepository';

export interface UseShelfReadablesResult {
  items: ShelfReadable[];
  isLoading: boolean;
  isError: boolean;
  error: AppError | null;
}

export function useShelfReadables(shelfId: string): UseShelfReadablesResult {
  const db = useDatabase();
  const { data, isLoading, isError, error } = useQuery<ShelfReadable[], AppError>({
    queryKey: shelfKeys.items(shelfId),
    queryFn: () => listShelfReadables(db, shelfId),
  });

  return {
    items: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
  };
}
