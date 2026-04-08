// src/features/shelves/hooks/useUpdateShelf.ts
// Mutation hook for renaming or reordering a shelf.
// Invalidates shelfKeys.all on success.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Shelf } from '../domain/shelf';
import { shelfKeys } from '../domain/queryKeys';
import { updateShelf, type UpdateShelfInput } from '../data/shelfRepository';

export interface UpdateShelfVariables {
  id: string;
  input: UpdateShelfInput;
}

export interface UseUpdateShelfResult {
  update: UseMutateFunction<Shelf, AppError, UpdateShelfVariables>;
  updateAsync: UseMutateAsyncFunction<Shelf, AppError, UpdateShelfVariables>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useUpdateShelf(): UseUpdateShelfResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    Shelf,
    AppError,
    UpdateShelfVariables
  >({
    mutationFn: ({ id, input }) => updateShelf(db, id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfKeys.all });
    },
  });

  return {
    update: mutate,
    updateAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
