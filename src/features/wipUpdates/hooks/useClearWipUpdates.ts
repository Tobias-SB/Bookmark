// src/features/wipUpdates/hooks/useClearWipUpdates.ts
// Mutation hook — bulk-deletes WipUpdate records.
//   'read'  → delete only records with status='read'
//   'all'   → delete all records regardless of status

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { wipUpdateKeys } from '../domain/queryKeys';
import { deleteReadWipUpdates, deleteAllWipUpdates } from '../data/wipUpdateRepository';

export type ClearMode = 'read' | 'all';

export interface UseClearWipUpdatesResult {
  clear: UseMutateFunction<void, Error, ClearMode>;
  isPending: boolean;
}

export function useClearWipUpdates(): UseClearWipUpdatesResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation<void, Error, ClearMode>({
    mutationFn: (mode: ClearMode) =>
      mode === 'read' ? deleteReadWipUpdates(db) : deleteAllWipUpdates(db),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
    },
  });

  return { clear: mutate, isPending };
}
