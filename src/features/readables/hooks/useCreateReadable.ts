// src/features/readables/hooks/useCreateReadable.ts
// §4, §12, §13 — Mutation hook for creating a readable.
// Applies §4 consistency rules before passing input to the repository.
// Invalidates readableKeys.all on success.
//
// Consistency rules applied here (not in repo, not in UI):
//   - Progress entered on want_to_read → auto-change status to reading.
//   - progressCurrent reaches progressTotal (known) → auto-change to completed.
//   - Status completed + total known → set progressCurrent = progressTotal.
//   - Status want_to_read → clear progressCurrent.
//   - Safety: isComplete=true with unknown total → isComplete=false (AO3 rule;
//     form superRefine is the primary guard — this is defense in depth).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Readable, ReadableStatus } from '../domain/readable';
import { readableKeys } from '../domain/queryKeys';
import { createReadable, type CreateReadableInput } from '../data/readableRepository';

// ── Consistency rules ─────────────────────────────────────────────────────────

/**
 * Applies §4 status/progress consistency rules to a create input.
 * Called in the hook layer — never in the repository or UI.
 */
export function applyCreateConsistency(input: CreateReadableInput): CreateReadableInput {
  const effectiveStatus: ReadableStatus = input.status ?? 'want_to_read';
  const progressCurrent: number | null = input.progressCurrent ?? null;
  const progressTotal: number | null = input.progressTotal ?? null;

  let resolvedStatus = effectiveStatus;
  let resolvedProgressCurrent = progressCurrent;

  // Rule 1: Progress entered on want_to_read → auto-change to reading.
  // On create, any non-null progressCurrent counts as "entered".
  if (resolvedStatus === 'want_to_read' && resolvedProgressCurrent !== null) {
    resolvedStatus = 'reading';
  }

  // Rule 2: progressCurrent reaches progressTotal (known) → completed.
  if (
    resolvedProgressCurrent !== null &&
    progressTotal !== null &&
    resolvedProgressCurrent >= progressTotal
  ) {
    resolvedStatus = 'completed';
  }

  // Rule 3: Status completed + total known → set progressCurrent = progressTotal.
  if (resolvedStatus === 'completed' && progressTotal !== null) {
    resolvedProgressCurrent = progressTotal;
  }

  // Rule 5: Status want_to_read → clear progressCurrent.
  // Reaches here only if no progress was provided (rule 1 didn't fire).
  if (resolvedStatus === 'want_to_read') {
    resolvedProgressCurrent = null;
  }

  // Safety: isComplete=true with unknown total is semantically impossible (AO3: Complete
  // requires a known chapter count). The form superRefine is the primary guard; this
  // catches any path that bypasses the form (e.g. metadata import).
  const inputIsComplete = input.isComplete ?? null;
  const resolvedIsComplete: boolean | null =
    inputIsComplete === true && progressTotal === null ? false : inputIsComplete;

  return {
    ...input,
    status: resolvedStatus,
    progressCurrent: resolvedProgressCurrent,
    ...(resolvedIsComplete !== inputIsComplete && { isComplete: resolvedIsComplete }),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseCreateReadableResult {
  /** Fire-and-forget mutation. Pass onSuccess/onError in options for callbacks. */
  create: UseMutateFunction<Readable, AppError, CreateReadableInput>;
  /** Promise-returning variant — useful for form submissions that need to await the new id. */
  createAsync: UseMutateAsyncFunction<Readable, AppError, CreateReadableInput>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  /** Reset mutation state (clears error/data). */
  reset: () => void;
}

export function useCreateReadable(): UseCreateReadableResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    Readable,
    AppError,
    CreateReadableInput
  >({
    mutationFn: (input) => createReadable(db, applyCreateConsistency(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    create: mutate,
    createAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
