// src/features/readables/hooks/useUpdateNotes.ts
// v2 Phase 5 — Dedicated mutation hook for updating notes on a readable.
//
// Calls updateReadable with { notes } only. The repository auto-sets
// notesUpdatedAt whenever notes is present in an update input — the hook
// does not pass it explicitly.
//
// Invalidates readableKeys.all on success so both list and detail queries refresh.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { readableKeys } from '../domain/queryKeys';
import { updateReadable } from '../data/readableRepository';

export interface UseUpdateNotesResult {
  updateNotes: (notes: string | null) => void;
  updateNotesAsync: (notes: string | null) => Promise<void>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useUpdateNotes(readableId: string): UseUpdateNotesResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    string | null
  >({
    mutationFn: async (notes: string | null) => { await updateReadable(db, readableId, { notes }); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    updateNotes: mutate,
    updateNotesAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
