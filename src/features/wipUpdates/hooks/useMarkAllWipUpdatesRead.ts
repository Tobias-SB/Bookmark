// src/features/wipUpdates/hooks/useMarkAllWipUpdatesRead.ts
// Mutation hook — marks all unread WipUpdates as read in a single operation.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { wipUpdateKeys } from '../domain/queryKeys';
import { markAllWipUpdatesRead } from '../data/wipUpdateRepository';

export interface UseMarkAllWipUpdatesReadResult {
  markAllRead: UseMutateFunction<void, Error, void>;
  isPending: boolean;
}

export function useMarkAllWipUpdatesRead(): UseMarkAllWipUpdatesReadResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation<void, Error, void>({
    mutationFn: () => markAllWipUpdatesRead(db),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
    },
  });

  return { markAllRead: mutate, isPending };
}
