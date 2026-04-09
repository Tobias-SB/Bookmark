// src/features/readables/hooks/useDeleteReadable.ts
// §12, §13 — Mutation hook for hard-deleting a readable.
// Invalidates readableKeys.all on success so list and detail queries refresh.
//
// §3.4 — Before deleting, fetches the readable and calls deleteCoverFile so
// locally stored cover images are not orphaned in the covers directory.
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
import { getReadableById, deleteReadable } from '../data/readableRepository';
import { deleteCoverFile } from '../services/coverService';

// ── Variables type ────────────────────────────────────────────────────────────

export interface DeleteReadableVariables {
  id: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// Both sync (remove) and async (removeAsync) variants are exposed.
// Use remove with onSuccess for the detail screen's post-delete navigation.
// Use removeAsync when the caller needs to handle errors inline.

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
    mutationFn: async ({ id }) => {
      // §3.4 — Clean up local cover file before deleting the record.
      const readable = await getReadableById(db, id);
      if (readable?.coverUrl) {
        await deleteCoverFile(readable.coverUrl);
      }
      await deleteReadable(db, id);
    },
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
