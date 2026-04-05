// src/features/wipUpdates/hooks/useCheckWipUpdates.ts
// Mutation hook — runs the bulk WIP update checker.
//
// Flow:
//   1. Fetch all readables from DB.
//   2. Apply eligibility filter (fanfic, WIP, has sourceUrl, abandoned filter).
//   3. Apply scope filter (status filter).
//   4. Return early with an empty reason if no eligible works exist.
//   5. Delegate to checkWipUpdates service (handles rate limiting, AO3 fetches,
//      DB writes, and WipUpdate record creation), passing an onProgress callback.
//   6. On success, invalidate wipUpdates and readables queries.
//
// The caller awaits checkAsync to read the result and show a snackbar.

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { listReadables, readableKeys } from '../../readables';
import { wipUpdateKeys } from '../domain/queryKeys';
import { checkWipUpdates, type CheckWipUpdatesResult } from '../services/wipUpdateChecker';
import type { CheckProgressEvent, CheckWipScope, OnCheckProgress } from '../domain/wipUpdate';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseCheckWipUpdatesResult {
  checkAsync: (scope?: Partial<CheckWipScope>) => Promise<CheckWipUpdatesResult>;
  isPending: boolean;
  progress: {
    current: number;
    total: number;
    title: string;
    outcome: CheckProgressEvent['outcome'];
  } | null;
  /** Estimated seconds remaining. Null when not checking or fewer than 3 works timed. */
  estimatedRemaining: number | null;
  isError: boolean;
  error: Error | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_SCOPE: CheckWipScope = {
  statuses: ['reading'],
  includeAbandoned: false,
};

function buildEmptyReason(
  allEligibleCount: number,
  statuses: string[],
): string {
  if (allEligibleCount === 0) {
    return 'No WIP fanfics in your library.';
  }
  if (statuses.length === 1 && statuses[0] === 'reading') {
    return 'No WIPs with status Reading — try checking more statuses.';
  }
  return 'No WIPs match the selected statuses — try checking more statuses.';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCheckWipUpdates(): UseCheckWipUpdatesResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState<UseCheckWipUpdatesResult['progress']>(null);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);

  // Timing refs — stable across renders, no state needed
  const lastCallbackTimeRef = useRef<number | null>(null);
  const fetchTimingsRef = useRef<number[]>([]);

  const { mutateAsync, isPending, isError, error } = useMutation<
    CheckWipUpdatesResult,
    Error,
    Partial<CheckWipScope>
  >({
    mutationFn: async (scopeInput: Partial<CheckWipScope>) => {
      const effectiveScope: CheckWipScope = {
        statuses: scopeInput.statuses ?? DEFAULT_SCOPE.statuses,
        includeAbandoned: scopeInput.includeAbandoned ?? DEFAULT_SCOPE.includeAbandoned,
      };

      // Reset progress tracking for this run
      setProgress(null);
      setEstimatedRemaining(null);
      lastCallbackTimeRef.current = null;
      fetchTimingsRef.current = [];

      const all = await listReadables(db);

      // Eligibility: fanfic, explicitly WIP, has source URL, abandoned filter
      const allEligible = all.filter(
        r =>
          r.kind === 'fanfic' &&
          r.isComplete === false &&
          !!r.sourceUrl &&
          (effectiveScope.includeAbandoned || !r.isAbandoned),
      );

      if (allEligible.length === 0) {
        return {
          checked: 0,
          updated: 0,
          failed: 0,
          restricted: 0,
          staleSession: false,
          emptyReason: buildEmptyReason(0, effectiveScope.statuses),
        };
      }

      // Scope: filter by selected statuses
      const scopeFiltered = allEligible.filter(r =>
        effectiveScope.statuses.includes(r.status),
      );

      if (scopeFiltered.length === 0) {
        return {
          checked: 0,
          updated: 0,
          failed: 0,
          restricted: 0,
          staleSession: false,
          emptyReason: buildEmptyReason(allEligible.length, effectiveScope.statuses),
        };
      }

      // Build onProgress callback — closes over stable refs and state setters
      const onProgress: OnCheckProgress = (event: CheckProgressEvent) => {
        const now = Date.now();

        if (lastCallbackTimeRef.current !== null) {
          const elapsed = now - lastCallbackTimeRef.current;
          fetchTimingsRef.current.push(elapsed);

          const timings = fetchTimingsRef.current;
          if (timings.length >= 3) {
            const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
            const remaining = event.total - event.current;
            setEstimatedRemaining(Math.round((avg * remaining) / 1000));
          }
        }

        lastCallbackTimeRef.current = now;
        setProgress({
          current: event.current,
          total: event.total,
          title: event.title,
          outcome: event.outcome,
        });
      };

      return checkWipUpdates(db, scopeFiltered, onProgress);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: wipUpdateKeys.all });
      await queryClient.invalidateQueries({ queryKey: readableKeys.all });
    },
    onSettled: () => {
      setProgress(null);
      setEstimatedRemaining(null);
    },
  });

  const checkAsync = useCallback(
    (scope?: Partial<CheckWipScope>) => mutateAsync(scope ?? {}),
    [mutateAsync],
  );

  return {
    checkAsync,
    isPending,
    progress,
    estimatedRemaining,
    isError,
    error: error ?? null,
  };
}
