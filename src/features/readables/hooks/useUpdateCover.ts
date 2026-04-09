// src/features/readables/hooks/useUpdateCover.ts
// §3.3 — Mutation hook for updating a readable's cover image.
//
// Handles the full cover update lifecycle:
//   1. Fetch existing readable to get old coverUrl for cleanup.
//   2. Produce the new local URI based on mode.
//   3. Delete the old cover file if it was locally stored.
//   4. Persist the new coverUrl via updateReadable.
//   5. Invalidate readableKeys.all.
//
// On download failure: throws AppError with code 'network'.
// Caller shows a snackbar on error.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { readableKeys } from '../domain/queryKeys';
import { getReadableById, updateReadable } from '../data/readableRepository';
import {
  saveLocalCover,
  downloadCover,
  deleteCoverFile,
} from '../services/coverService';

// ── Input type ────────────────────────────────────────────────────────────────

export interface UpdateCoverInput {
  readableId: string;
  /** 'local' = copy a picker URI; 'url' = download a remote URL; 'remove' = set null. */
  mode: 'local' | 'url' | 'remove';
  /** Source URI for 'local' and 'url' modes. Omit for 'remove'. */
  uri?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// Only mutateAsync (updateCoverAsync) is exposed — cover updates are always awaited
// so that old file cleanup and cache invalidation happen in the correct sequence.

export interface UseUpdateCoverResult {
  updateCoverAsync: UseMutateAsyncFunction<void, AppError, UpdateCoverInput>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useUpdateCover(): UseUpdateCoverResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, reset } = useMutation<
    void,
    AppError,
    UpdateCoverInput
  >({
    mutationFn: async ({ readableId, mode, uri }) => {
      // 1. Fetch existing readable to get old coverUrl.
      const existing = await getReadableById(db, readableId);
      const oldCoverUrl = existing?.coverUrl ?? null;

      // 2. Produce the new coverUrl based on mode.
      let newCoverUrl: string | null = null;

      if (mode === 'local') {
        if (!uri) throw { code: 'validation', message: 'No source URI provided.' } satisfies AppError;
        newCoverUrl = await saveLocalCover(uri);
      } else if (mode === 'url') {
        if (!uri) throw { code: 'validation', message: 'No URL provided.' } satisfies AppError;
        const downloaded = await downloadCover(uri);
        if (downloaded === null) {
          throw {
            code: 'network',
            message: 'Could not download the image. Check the URL and your connection.',
          } satisfies AppError;
        }
        newCoverUrl = downloaded;
      }
      // mode === 'remove' → newCoverUrl stays null

      // 3. Persist the new coverUrl.
      await updateReadable(db, readableId, { coverUrl: newCoverUrl });

      // 4. Delete the old local cover file (after successful persist).
      await deleteCoverFile(oldCoverUrl);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    updateCoverAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
