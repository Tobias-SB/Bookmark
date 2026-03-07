// src/features/readables/hooks/useDeleteReadable.ts
// §12, §13 — Mutation hook for hard-deleting a readable.
// Invalidates readableKeys.all on success so list and detail queries refresh.
//
// The caller is responsible for:
//   - Requiring explicit user confirmation before calling remove().
//   - Navigating away from the detail screen on success via onSuccess callback:
//       remove({ id }, { onSuccess: () => navigation.navigate('MainTabs') })

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { readableKeys } from '../domain/queryKeys';
import { deleteReadable } from '../data/readableRepository';

// ── Variables type ────────────────────────────────────────────────────────────

export interface DeleteReadableVariables {
  id: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseDeleteReadableResult {
  /**
   * Fire-and-forget delete. Pass onSuccess to trigger navigation:
   *   remove({ id }, { onSuccess: () => navigation.navigate('MainTabs') })
   */
  remove: UseMutateFunction<void, AppError, DeleteReadableVariables>;
  /** Promise-returning variant. */
  removeAsync: UseMutateAsyncFunction<void, AppError, DeleteReadableVariables>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  /** Reset mutation state (clears error). */
  reset: () => void;
}

export function useDeleteReadable(): UseDeleteReadableResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    DeleteReadableVariables
  >({
    mutationFn: ({ id }) => deleteReadable(db, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    remove: mutate,
    removeAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
