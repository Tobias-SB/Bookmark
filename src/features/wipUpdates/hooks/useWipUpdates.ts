// src/features/wipUpdates/hooks/useWipUpdates.ts
// Query hook — returns all WipUpdate records, sorted: unread first, then
// by checkedAt descending.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { WipUpdate } from '../domain/wipUpdate';
import { wipUpdateKeys } from '../domain/queryKeys';
import { listWipUpdates } from '../data/wipUpdateRepository';

export interface UseWipUpdatesResult {
  updates: WipUpdate[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useWipUpdates(): UseWipUpdatesResult {
  const db = useDatabase();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: wipUpdateKeys.lists(),
    queryFn: () => listWipUpdates(db),
  });

  return {
    updates: data ?? [],
    isLoading,
    isError,
    error: error ?? null,
  };
}
