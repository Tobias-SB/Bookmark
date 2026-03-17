// src/features/wipUpdates/hooks/useCheckWipUpdates.ts
// Mutation hook — runs the bulk WIP update checker.
//
// Flow:
//   1. Fetch all readables from DB.
//   2. Filter for eligible works (fanfic, WIP, has sourceUrl).
//   3. Delegate to checkWipUpdates service (handles rate limiting, AO3 fetches,
//      DB writes, and WipUpdate record creation).
//   4. On success, invalidate wipUpdates and readables queries.
//
// The caller awaits checkAsync to read the result and show a snackbar.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { listReadables, readableKeys } from '../../readables';
import { wipUpdateKeys } from '../domain/queryKeys';
import { checkWipUpdates, type CheckWipUpdatesResult } from '../services/wipUpdateChecker';

export interface UseCheckWipUpdatesResult {
  checkAsync: UseMutateAsyncFunction<CheckWipUpdatesResult, Error, void>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

export function useCheckWipUpdates(): UseCheckWipUpdatesResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error } = useMutation<
    CheckWipUpdatesResult,
    Error,
    void
  >({
    mutationFn: async () => {
      const all = await listReadables(db);
      const eligible = all.filter(
        r => r.kind === 'fanfic' && r.isComplete === false && !!r.sourceUrl,
      );
      return checkWipUpdates(db, eligible);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    checkAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
  };
}
