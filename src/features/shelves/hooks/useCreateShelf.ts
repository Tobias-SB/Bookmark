// src/features/shelves/hooks/useCreateShelf.ts
// Mutation hook for creating a new shelf.
// Invalidates shelfKeys.all on success.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Shelf } from '../domain/shelf';
import { shelfKeys } from '../domain/queryKeys';
import { createShelf, type CreateShelfInput } from '../data/shelfRepository';

// Both sync (create) and async (createAsync) variants are exposed.
// Use createAsync when the caller needs to immediately navigate to the new shelf.

export interface UseCreateShelfResult {
  create: UseMutateFunction<Shelf, AppError, CreateShelfInput>;
  createAsync: UseMutateAsyncFunction<Shelf, AppError, CreateShelfInput>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useCreateShelf(): UseCreateShelfResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    Shelf,
    AppError,
    CreateShelfInput
  >({
    mutationFn: (input) => createShelf(db, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfKeys.all });
    },
  });

  return {
    create: mutate,
    createAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
