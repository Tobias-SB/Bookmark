// src/features/wipUpdates/hooks/useDeleteWipUpdate.ts
// Mutation hook — hard-deletes a single WipUpdate record by id.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { wipUpdateKeys } from '../domain/queryKeys';
import { deleteWipUpdate } from '../data/wipUpdateRepository';

export interface UseDeleteWipUpdateResult {
  remove: UseMutateFunction<void, Error, string>;
  isPending: boolean;
}

export function useDeleteWipUpdate(): UseDeleteWipUpdateResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteWipUpdate(db, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
    },
  });

  return { remove: mutate, isPending };
}
