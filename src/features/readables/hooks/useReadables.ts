// src/features/readables/hooks/useReadables.ts
import { useQuery } from '@tanstack/react-query';
import { readableRepository } from '@src/features/readables/services/readableRepository';
import type { ReadableItem } from '@src/features/readables/types';

export function useReadables() {
  return useQuery<ReadableItem[]>({
    queryKey: ['readables', 'all'],
    queryFn: () => readableRepository.getAll(),
  });
}
