// src/features/shelves/hooks/useRemoveFromShelf.ts
// Mutation hook for removing a readable from a shelf.
// Invalidates shelfKeys.all on success.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { shelfKeys } from '../domain/queryKeys';
import { removeFromShelf } from '../data/shelfRepository';

export interface RemoveFromShelfVariables {
  shelfId: string;
  readableId: string;
}

// Both sync (removeItem) and async (removeItemAsync) variants are exposed.
// Use removeItem for immediate swipe-to-remove actions; use removeItemAsync for confirm-then-remove flows.

export interface UseRemoveFromShelfResult {
  removeItem: UseMutateFunction<void, AppError, RemoveFromShelfVariables>;
  removeItemAsync: UseMutateAsyncFunction<void, AppError, RemoveFromShelfVariables>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useRemoveFromShelf(): UseRemoveFromShelfResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    RemoveFromShelfVariables
  >({
    mutationFn: ({ shelfId, readableId }) => removeFromShelf(db, shelfId, readableId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfKeys.all });
    },
  });

  return {
    removeItem: mutate,
    removeItemAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
