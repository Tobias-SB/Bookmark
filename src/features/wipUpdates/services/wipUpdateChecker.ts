// src/features/wipUpdates/services/wipUpdateChecker.ts
// Orchestration service for bulk WIP update checks.
//
// Eligibility rules (enforced in both hook and service layers):
//   - kind === 'fanfic'
//   - isComplete === false  (explicitly WIP, not null/unknown)
//   - sourceUrl is a non-empty string  (same gate as useRefreshReadableMetadata)
//
// Rate limiting: 1500–2500ms random jitter between fetches to avoid hammering AO3.
// Continues on per-work failure — never aborts the batch.
//
// Gate: if ao3UpdatedAt is unchanged, skip and record no WipUpdate (no noise).
//
// Provisional decision: uses sourceUrl (not sourceId) for the AO3 fetch URL,
// consistent with useRefreshReadableMetadata. sourceId is used only for
// duplicate detection elsewhere.

import type { SQLiteDatabase } from 'expo-sqlite';

import type { Readable } from '../../readables';
import { ao3RateLimitDelay } from '../../../shared/utils/ao3RateLimit';
import { refreshReadableMetadata } from '../../readables';
import { fetchAo3Metadata } from '../../metadata';
import { createWipUpdate } from '../data/wipUpdateRepository';
import type { OnCheckProgress } from '../domain/wipUpdate';
import { getAo3Session } from '../../ao3Auth/services/ao3CookieService';

// ── Result type ───────────────────────────────────────────────────────────────

export interface CheckWipUpdatesResult {
  /** Total number of eligible works that were attempted. */
  checked: number;
  /** Number of works where AO3 returned changed data (a WipUpdate was created). */
  updated: number;
  /** Number of works that failed due to a network or parse error. */
  failed: number;
  /** Number of works that could not be fetched due to AO3 login restrictions. */
  restricted: number;
  /**
   * True when a previously active AO3 session was cleared during the batch,
   * meaning the cookie expired mid-check. The user should re-login.
   */
  staleSession: boolean;
  /**
   * Human-readable reason when checked === 0, explaining why no works were checked.
   * Only set in the early-return path (no service call was made).
   */
  emptyReason?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEligible(readable: Readable): boolean {
  return (
    readable.kind === 'fanfic' &&
    readable.isComplete === false &&
    typeof readable.sourceUrl === 'string' &&
    readable.sourceUrl.length > 0
  );
}


// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Checks each eligible readable against AO3 sequentially with rate limiting.
 * Eligible readables should already be filtered by the caller (hook layer);
 * this function re-guards as defense in depth.
 *
 * The optional onProgress callback fires immediately after each work resolves,
 * before the rate-limit delay for the next work.
 */
export async function checkWipUpdates(
  db: SQLiteDatabase,
  eligibleReadables: Readable[],
  onProgress?: OnCheckProgress,
): Promise<CheckWipUpdatesResult> {
  const eligible = eligibleReadables.filter(isEligible);
  const checked = eligible.length;
  let updated = 0;
  let failed = 0;
  let restricted = 0;

  // Snapshot session state before the batch so we can detect mid-batch expiry.
  const sessionActiveAtStart = (await getAo3Session()) !== null;

  for (let i = 0; i < eligible.length; i++) {
    // Rate-limit: pause before every fetch except the first
    if (i > 0) await ao3RateLimitDelay();

    const readable = eligible[i];

    try {
      // Fetch AO3 metadata
      const result = await fetchAo3Metadata(readable.sourceUrl as string);
      const fetched = result.data;

      // Network failure guard: if errors and no meaningful content, count as failed/restricted
      if (result.errors.length > 0 && !fetched.title && !fetched.ao3UpdatedAt) {
        if (result.isRestricted === true) {
          restricted++;
          onProgress?.({ current: i + 1, total: eligible.length, title: readable.title, outcome: 'restricted' });
        } else {
          failed++;
          onProgress?.({ current: i + 1, total: eligible.length, title: readable.title, outcome: 'failed' });
        }
        continue;
      }

      // ao3UpdatedAt gate: absent or unchanged → skip (no noise in the inbox)
      if (!fetched.ao3UpdatedAt || fetched.ao3UpdatedAt === readable.ao3UpdatedAt) {
        onProgress?.({ current: i + 1, total: eligible.length, title: readable.title, outcome: 'unchanged' });
        continue;
      }

      // Build effective refresh values — fall back to existing values for arrays
      // (avoids clearing data on a partial parse, same logic as useRefreshReadableMetadata)
      const effectiveTags = fetched.tags ?? readable.tags;
      const effectiveRelationships = fetched.relationships ?? readable.relationships;
      const effectiveArchiveWarnings = fetched.archiveWarnings ?? readable.archiveWarnings;

      // Apply refresh to the DB
      const refreshResult = await refreshReadableMetadata(db, readable.id, {
        availableChapters: fetched.availableChapters ?? null,
        totalUnits: fetched.totalUnits ?? null,
        wordCount: fetched.wordCount ?? null,
        isComplete: fetched.isComplete ?? null,
        ao3UpdatedAt: fetched.ao3UpdatedAt,
        tags: effectiveTags,
        relationships: effectiveRelationships,
        archiveWarnings: effectiveArchiveWarnings,
        seriesTotal: fetched.seriesTotal ?? null,
      });

      // Record the before/after snapshot as an unread WipUpdate
      await createWipUpdate(db, {
        readableId: readable.id,
        readableTitle: readable.title,
        readableAuthor: readable.author,
        checkedAt: new Date().toISOString(),
        previousAvailableChapters: readable.availableChapters,
        fetchedAvailableChapters: fetched.availableChapters ?? null,
        previousTotalUnits: readable.totalUnits,
        fetchedTotalUnits: fetched.totalUnits ?? null,
        previousWordCount: readable.wordCount,
        fetchedWordCount: fetched.wordCount ?? null,
        previousIsComplete: readable.isComplete,
        fetchedIsComplete: fetched.isComplete ?? null,
        previousTags: readable.tags,
        fetchedTags: effectiveTags,
        previousRelationships: readable.relationships,
        fetchedRelationships: effectiveRelationships,
        previousArchiveWarnings: readable.archiveWarnings,
        fetchedArchiveWarnings: effectiveArchiveWarnings,
        previousSeriesTotal: readable.seriesTotal,
        fetchedSeriesTotal: fetched.seriesTotal ?? null,
        previousAo3UpdatedAt: readable.ao3UpdatedAt,
        fetchedAo3UpdatedAt: fetched.ao3UpdatedAt ?? null,
        statusReverted: refreshResult.statusReverted,
      });

      updated++;
      onProgress?.({ current: i + 1, total: eligible.length, title: readable.title, outcome: 'updated' });
    } catch {
      // Per-work error: continue the batch
      failed++;
      onProgress?.({ current: i + 1, total: eligible.length, title: readable.title, outcome: 'failed' });
    }
  }

  // Stale session: a session was active at start, restricted works were encountered,
  // and the session was cleared by ao3Fetch mid-batch (expired cookie detected).
  const staleSession =
    sessionActiveAtStart && restricted > 0 && !(await getAo3Session());

  return { checked, updated, failed, restricted, staleSession };
}
