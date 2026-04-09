// src/features/shelves/hooks/useDeleteShelf.ts
// Mutation hook for deleting a shelf.
// ON DELETE CASCADE in the schema removes shelf_readables automatically.
// Invalidates shelfKeys.all on success.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { shelfKeys } from '../domain/queryKeys';
import { deleteShelf } from '../data/shelfRepository';

// Both sync (remove) and async (removeAsync) variants are exposed.
// Use remove with onSuccess for post-delete navigation; use removeAsync for inline error handling.

export interface UseDeleteShelfResult {
  remove: UseMutateFunction<void, AppError, string>;
  removeAsync: UseMutateAsyncFunction<void, AppError, string>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useDeleteShelf(): UseDeleteShelfResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    string
  >({
    mutationFn: (id) => deleteShelf(db, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfKeys.all });
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
