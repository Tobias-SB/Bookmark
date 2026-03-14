// src/features/readables/hooks/useReadable.ts
// §9, §13 — Fetches a single readable by its local id.
//
// Return shape for `readable`:
//   undefined  — query in flight (not yet fetched)
//   null       — fetched; record not found
//   Readable   — fetched; record found
// Callers should distinguish undefined (loading) from null (not found) to
// render appropriate UI states.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Readable } from '../domain/readable';
import { readableKeys } from '../domain/queryKeys';
import { getReadableById } from '../data/readableRepository';

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseReadableResult {
  /** undefined = loading, null = not found, Readable = found */
  readable: Readable | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: AppError | null;
  /** Manually re-run the query — useful for error retry actions. */
  refetch: () => void;
}

/** Returns a single readable by its local id. */
export function useReadable(id: string): UseReadableResult {
  const db = useDatabase();

  const { data, isLoading, isError, error, refetch } = useQuery<Readable | null, AppError>({
    queryKey: readableKeys.detail(id),
    queryFn: () => getReadableById(db, id),
  });

  return {
    readable: data,
    isLoading,
    isError,
    error: error ?? null,
    refetch: () => { void refetch(); },
  };
}
