// src/features/readables/hooks/useUpdateReadable.ts
// §4, §12, §13 — Mutation hook for updating a readable.
// Applies §4 consistency rules before passing input to the repository.
// Invalidates readableKeys.all on success.
//
// Consistency rules applied here (not in repo, not in UI):
//   - Progress entered on want_to_read → auto-change status to reading.
//   - progressCurrent reaches progressTotal (known) → auto-change to completed.
//   - Status completed + total known → set progressCurrent = progressTotal.
//   - Status dnf → preserve partial progress (no action needed).
//   - Status want_to_read → clear progressCurrent.
//   - isComplete coherence: isComplete=true with unknown total → isComplete=false.
//     Covers the ProgressEditor path (user clears progressTotal while isComplete was true)
//     and self-heals any pre-existing broken records on next write.
//
// The caller passes `current` (the existing Readable) alongside the update input
// so the hook can resolve effective post-update values without a redundant fetch.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutateFunction, UseMutateAsyncFunction } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { AppError } from '../../../shared/types/errors';
import type { Readable, ReadableStatus } from '../domain/readable';
import { readableKeys } from '../domain/queryKeys';
import { updateReadable, type UpdateReadableInput } from '../data/readableRepository';

// ── Variables type ────────────────────────────────────────────────────────────

export interface UpdateReadableVariables {
  id: string;
  input: UpdateReadableInput;
  /**
   * The current readable state before this update.
   * Required to resolve effective post-update values for consistency rules.
   * The detail screen already has this in hand — pass it here directly.
   */
  current: Readable;
}

// ── Consistency rules ─────────────────────────────────────────────────────────

/**
 * Applies §4 status/progress consistency rules to an update input.
 * Called in the hook layer — never in the repository or UI.
 *
 * Uses `current` to determine effective post-update values, so rules work
 * correctly whether the user is changing status, progress, or both at once.
 */
function applyUpdateConsistency(
  input: UpdateReadableInput,
  current: Readable,
): UpdateReadableInput {
  // Resolve effective values after applying input over current state.
  const progressCurrentInInput = 'progressCurrent' in input;

  const effectiveStatus: ReadableStatus = input.status ?? current.status;
  const effectiveProgressCurrent: number | null = progressCurrentInInput
    ? (input.progressCurrent ?? null)
    : current.progressCurrent;
  const effectiveProgressTotal: number | null =
    'progressTotal' in input ? (input.progressTotal ?? null) : current.progressTotal;
  const effectiveIsComplete: boolean | null =
    'isComplete' in input ? (input.isComplete ?? null) : current.isComplete;

  let resolvedStatus = effectiveStatus;
  let resolvedProgressCurrent = effectiveProgressCurrent;

  // Rule 1: Progress entered on want_to_read → auto-change to reading.
  // "Entered" = progressCurrent key is present in input AND value is non-null.
  if (
    resolvedStatus === 'want_to_read' &&
    progressCurrentInInput &&
    resolvedProgressCurrent !== null
  ) {
    resolvedStatus = 'reading';
  }

  // Rule 2: progressCurrent reaches progressTotal (known) → completed.
  if (
    resolvedProgressCurrent !== null &&
    effectiveProgressTotal !== null &&
    resolvedProgressCurrent >= effectiveProgressTotal
  ) {
    resolvedStatus = 'completed';
  }

  // Rule 3: Status completed + total known → set progressCurrent = progressTotal.
  // Also handles the case where rule 2 just set status to completed.
  if (resolvedStatus === 'completed' && effectiveProgressTotal !== null) {
    resolvedProgressCurrent = effectiveProgressTotal;
  }

  // Rule 5: Status want_to_read → clear progressCurrent.
  // Only reached when status stays want_to_read (rule 1 did not fire),
  // meaning no new progress was entered. Clears any existing progress.
  if (resolvedStatus === 'want_to_read') {
    resolvedProgressCurrent = null;
  }

  // Rule 4 (dnf): preserve partial progress — no action needed.
  // The resolved values are unchanged when status = dnf.

  // isComplete coherence: isComplete=true with unknown progressTotal is semantically
  // impossible (AO3 "Complete" always has a known chapter count). This fires when
  // the ProgressEditor clears progressTotal on a record that was already marked complete,
  // and also self-heals any pre-existing broken records on next write.
  let resolvedIsComplete = effectiveIsComplete;
  if (resolvedIsComplete === true && effectiveProgressTotal === null) {
    resolvedIsComplete = false;
  }

  const result: UpdateReadableInput = {
    ...input,
    status: resolvedStatus,
    progressCurrent: resolvedProgressCurrent,
  };
  // Only write isComplete back when the rule changed it — avoids write amplification
  // on updates that don't touch isComplete (e.g. status-only or progress-only updates).
  if (resolvedIsComplete !== effectiveIsComplete) {
    result.isComplete = resolvedIsComplete;
  }
  return result;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseUpdateReadableResult {
  /** Fire-and-forget mutation. Pass onSuccess/onError in options for callbacks. */
  update: UseMutateFunction<Readable, AppError, UpdateReadableVariables>;
  /** Promise-returning variant — useful when the caller needs to await the result. */
  updateAsync: UseMutateAsyncFunction<Readable, AppError, UpdateReadableVariables>;
  isPending: boolean;
  isError: boolean;
  error: AppError | null;
  /** Reset mutation state (clears error/data). */
  reset: () => void;
}

export function useUpdateReadable(): UseUpdateReadableResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, reset } = useMutation<
    Readable,
    AppError,
    UpdateReadableVariables
  >({
    mutationFn: ({ id, input, current }) =>
      updateReadable(db, id, applyUpdateConsistency(input, current)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
  });

  return {
    update: mutate,
    updateAsync: mutateAsync,
    isPending,
    isError,
    error: error ?? null,
    reset,
  };
}
