// src/features/readables/hooks/useRefreshReadableMetadata.ts
// v2 — Mutation hook for refreshing AO3 metadata on a single readable.
//
// This is the first hook in readables/hooks that imports from the metadata
// feature (ao3Parser). Cross-feature import pattern: metadata service is
// imported directly from its file path (not through an index) since services
// are not exported from a metadata/index.ts.
//
// Mutation input: readableId (string)
// Mutation output: RefreshResult { updated: boolean, statusReverted: boolean }
//
// Flow:
//   1. Fetch current readable by id
//   2. Guard: sourceUrl must be present
//   3. Call fetchAo3Metadata — network failure guard if no content extracted
//   4. ao3UpdatedAt gate: if unchanged, skip write and return { updated: false }
//   5. Call refreshReadableMetadata — only updates the fields listed in RefreshMetadataInput
//   6. Return { updated: true, statusReverted } from the refresh result
//
// Snackbar messages (consumed by ReadableDetailScreen in Phase 5):
//   updated=false                → "No changes — already up to date"
//   updated=true, !statusReverted → "Metadata updated"
//   updated=true, statusReverted  → "New chapters found — reverted to Reading"
//   error                         → "Could not refresh — check your connection and try again"

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import { readableKeys } from '../domain/queryKeys';
import { getReadableById, refreshReadableMetadata } from '../data/readableRepository';
import { fetchAo3Metadata } from '../../metadata/services/ao3Parser';

// ── Result types ──────────────────────────────────────────────────────────────

export interface RefreshResult {
  updated: boolean;
  statusReverted: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseRefreshReadableMetadataResult {
  /** Promise-returning variant — callers await this to read the RefreshResult for snackbar selection. */
  refreshAsync: UseMutateAsyncFunction<RefreshResult, AppError, string>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useRefreshReadableMetadata(): UseRefreshReadableMetadataResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, reset } = useMutation<
    RefreshResult,
    AppError,
    string
  >({
    mutationFn: async (readableId: string): Promise<RefreshResult> => {
      // 1. Fetch current readable
      const readable = await getReadableById(db, readableId);
      if (!readable) {
        const err: AppError = { code: 'not_found', message: 'Readable not found.' };
        throw err;
      }

      // 2. Guard: must have a source URL to refresh from
      if (!readable.sourceUrl) {
        const err: AppError = { code: 'validation', message: 'No source URL for this readable.' };
        throw err;
      }

      // 3. Fetch AO3 metadata
      const result = await fetchAo3Metadata(readable.sourceUrl);
      const fetched = result.data;

      // Network failure guard: if errors and no meaningful content extracted, fail fast.
      if (result.errors.length > 0 && !fetched.title && !fetched.ao3UpdatedAt) {
        const err: AppError = {
          code: 'network',
          message: result.errors[0] ?? 'Failed to fetch AO3 metadata.',
        };
        throw err;
      }

      // 4. ao3UpdatedAt gate: if the date is present and unchanged, nothing to update.
      if (
        fetched.ao3UpdatedAt !== undefined &&
        fetched.ao3UpdatedAt !== null &&
        fetched.ao3UpdatedAt === readable.ao3UpdatedAt
      ) {
        return { updated: false, statusReverted: false };
      }

      // 5. Apply refresh — only the fields listed in RefreshMetadataInput are written.
      //    For array fields, fall back to existing values if not extracted (avoids clearing on partial parse).
      const refreshResult = await refreshReadableMetadata(db, readableId, {
        availableChapters: fetched.availableChapters ?? null,
        totalUnits: fetched.totalUnits ?? null,
        wordCount: fetched.wordCount ?? null,
        isComplete: fetched.isComplete ?? null,
        ao3UpdatedAt: fetched.ao3UpdatedAt ?? null,
        tags: fetched.tags ?? readable.tags,
        relationships: fetched.relationships ?? readable.relationships,
        archiveWarnings: fetched.archiveWarnings ?? readable.archiveWarnings,
        seriesTotal: fetched.seriesTotal ?? null,
      });

      return { updated: true, ...refreshResult };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    refreshAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
