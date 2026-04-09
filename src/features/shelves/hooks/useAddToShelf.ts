// src/features/shelves/hooks/useAddToShelf.ts
// Mutation hook for adding a readable to a shelf.
// Invalidates shelfKeys.all on success (updates items queries for the shelf).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { shelfKeys } from '../domain/queryKeys';
import { addToShelf } from '../data/shelfRepository';

export interface AddToShelfVariables {
  shelfId: string;
  readableId: string;
}

// Both sync (add) and async (addAsync) variants are exposed.
// addToShelf is idempotent — safe to call even if the readable is already a member.

export interface UseAddToShelfResult {
  add: UseMutateFunction<void, AppError, AddToShelfVariables>;
  addAsync: UseMutateAsyncFunction<void, AppError, AddToShelfVariables>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useAddToShelf(): UseAddToShelfResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    AddToShelfVariables
  >({
    mutationFn: ({ shelfId, readableId }) => addToShelf(db, shelfId, readableId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfKeys.all });
    },
  });

  return {
    add: mutate,
    addAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
