// src/features/readables/hooks/useReadableById.ts
import { useQuery } from '@tanstack/react-query';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import type { ReadableItem } from '@src/features/readables/types';

export function useReadableById(id: string | undefined) {
  return useQuery<ReadableItem | null>({
    queryKey: ['readable', id],
    enabled: !!id,
    queryFn: () => {
      if (!id) {
        return Promise.resolve(null);
      }
      return readableRepository.getById(id);
    },
  });
}
