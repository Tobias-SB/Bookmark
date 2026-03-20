// src/features/readables/hooks/useUpdateReadable.ts
// §4, §12, §13 — Mutation hook for updating a readable.
// Applies §4 consistency rules before passing input to the repository.
// Invalidates readableKeys.all on success.
//
// Consistency rules applied here (not in repo, not in UI):
//   - Progress entered on want_to_read → auto-change status to reading.
//   - progressCurrent explicitly set and reaches threshold → auto-change to completed.
//     Threshold: fanfic → availableChapters (if set), else totalUnits. Book → totalUnits.
//     Rule 2 only fires when progressCurrent is explicitly in the input — inherited progress
//     is never re-evaluated, which prevents the re-completion loop when the user manually
//     changes status from completed to reading (progress is still at threshold in current).
//   - Auto-completion (Rule 2) OR status explicitly set to completed → pin progressCurrent
//     to threshold.
//   - Status is inherited-completed and user explicitly lowers progress below threshold
//     and no status change is in the input → revert status to reading.
//   - Status dnf → preserve partial progress (no action needed).
//   - Status want_to_read → clear progressCurrent.
//   - isComplete coherence: isComplete=true with unknown totalUnits → isComplete=false.
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
export function applyUpdateConsistency(
  input: UpdateReadableInput,
  current: Readable,
): UpdateReadableInput {
  // Resolve effective values after applying input over current state.
  const progressCurrentInInput = 'progressCurrent' in input;
  const statusExplicitlySet = 'status' in input;
  const statusExplicitlyCompleted = statusExplicitlySet && input.status === 'completed';

  const effectiveStatus: ReadableStatus = input.status ?? current.status;
  const effectiveProgressCurrent: number | null = progressCurrentInInput
    ? (input.progressCurrent ?? null)
    : current.progressCurrent;
  const effectiveProgressTotal: number | null =
    'totalUnits' in input ? (input.totalUnits ?? null) : current.totalUnits;
  const effectiveIsComplete: boolean | null =
    'isComplete' in input ? (input.isComplete ?? null) : current.isComplete;

  // Completion threshold: for fanfics use availableChapters (the published count) if set,
  // since that is what the user can actually read. Fall back to totalUnits for both kinds.
  // availableChapters is import-only and never in UpdateReadableInput, so always from current.
  const effectiveCompletionThreshold: number | null =
    current.kind === 'fanfic' && current.availableChapters !== null
      ? current.availableChapters
      : effectiveProgressTotal;

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

  // Rule 2: progressCurrent explicitly set and reaches threshold → auto-change to completed.
  // IMPORTANT: gated on progressCurrentInInput — inherited progress is never re-evaluated.
  // Without this gate, changing status from completed → reading (no progress in input) would
  // trigger Rule 2 because current.progressCurrent still equals the threshold, immediately
  // re-completing the readable and creating an unbreakable loop.
  let rule2Fired = false;
  if (
    progressCurrentInInput &&
    resolvedProgressCurrent !== null &&
    effectiveCompletionThreshold !== null &&
    resolvedProgressCurrent >= effectiveCompletionThreshold
  ) {
    resolvedStatus = 'completed';
    rule2Fired = true;
  }

  // Rule 3: Pin progressCurrent to the threshold when:
  //   a) Rule 2 just auto-completed (progress reached threshold), or
  //   b) User explicitly selected completed via the status pills.
  // This keeps the displayed position consistent with "done".
  if ((rule2Fired || statusExplicitlyCompleted) && effectiveCompletionThreshold !== null) {
    resolvedProgressCurrent = effectiveCompletionThreshold;
  }

  // Revert rule: If the readable is already completed (status inherited, not just set or
  // auto-completed) and the user explicitly enters a progress value below the threshold,
  // revert status to reading so they are not locked at 100%.
  const userLoweringBelowThreshold =
    progressCurrentInInput &&
    resolvedProgressCurrent !== null &&
    effectiveCompletionThreshold !== null &&
    resolvedProgressCurrent < effectiveCompletionThreshold;
  if (resolvedStatus === 'completed' && !rule2Fired && !statusExplicitlySet && userLoweringBelowThreshold) {
    resolvedStatus = 'reading';
  }

  // Rule 5: Status want_to_read → clear progressCurrent.
  // Only reached when status stays want_to_read (rule 1 did not fire),
  // meaning no new progress was entered. Clears any existing progress.
  if (resolvedStatus === 'want_to_read') {
    resolvedProgressCurrent = null;
  }

  // Rule 4 (dnf): preserve partial progress — no action needed.
  // The resolved values are unchanged when status = dnf.

  // isComplete coherence: isComplete=true with unknown totalUnits is semantically
  // impossible (AO3 "Complete" always has a known chapter count). Self-heals any
  // pre-existing broken records on next write.
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
