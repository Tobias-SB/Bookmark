// src/features/readables/hooks/useSmartShelves.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shelfRepository } from '@src/features/readables/services/shelfReoisitory';
import type {
  CreateSmartShelfInput,
  SmartShelf,
  SmartShelfId,
  UpdateSmartShelfInput,
} from '@src/features/readables/types/smartShelves';

const SMART_SHELVES_QUERY_KEY = ['smartShelves'];

export function useSmartShelves() {
  return useQuery<SmartShelf[]>({
    queryKey: SMART_SHELVES_QUERY_KEY,
    queryFn: () => shelfRepository.getAll(),
  });
}

export function useCreateSmartShelf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSmartShelfInput) => shelfRepository.insert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SMART_SHELVES_QUERY_KEY });
    },
  });
}

export function useUpdateSmartShelf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateSmartShelfInput) => shelfRepository.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SMART_SHELVES_QUERY_KEY });
    },
  });
}

export function useDeleteSmartShelf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: SmartShelfId) => shelfRepository.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SMART_SHELVES_QUERY_KEY });
    },
  });
}
