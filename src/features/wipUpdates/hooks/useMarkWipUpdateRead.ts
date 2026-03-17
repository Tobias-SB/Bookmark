// src/features/wipUpdates/hooks/useMarkWipUpdateRead.ts
// Mutation hook — marks a single WipUpdate as read by id.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { wipUpdateKeys } from '../domain/queryKeys';
import { markWipUpdateRead } from '../data/wipUpdateRepository';

export interface UseMarkWipUpdateReadResult {
  markRead: UseMutateFunction<void, Error, string>;
  isPending: boolean;
}

export function useMarkWipUpdateRead(): UseMarkWipUpdateReadResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation<void, Error, string>({
    mutationFn: (id: string) => markWipUpdateRead(db, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
    },
  });

  return { markRead: mutate, isPending };
}
