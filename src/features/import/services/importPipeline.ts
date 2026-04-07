// src/features/import/services/importPipeline.ts
// Sequential AO3 fetch-and-create loop with rate limiting.
//
// Pattern mirrors wipUpdateChecker.ts:
//   - Sequential processing, rate-limited between fetches
//   - Per-work errors never abort the batch
//   - onProgress fires after each URL resolves (before the next rate-limit delay)
//
// Architecture note (§4): All imports use status='want_to_read' and
// progressCurrent=null, so the §4 consistency rules are trivially satisfied
// by construction. applyCreateConsistency would be a no-op here — it is
// intentionally not called to avoid importing a hook-layer symbol into a service.

import type { SQLiteDatabase } from 'expo-sqlite';

import { fetchAo3Metadata } from '../../metadata';
import { findReadableBySourceId, createReadable } from '../../readables';
import type { CreateReadableInput } from '../../readables';
import { processAo3Url } from '../../../shared/utils/ao3Url';
import { ao3RateLimitDelay } from '../../../shared/utils/ao3RateLimit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportProgress {
  total: number;
  completed: number;
  /** Works successfully created in the library. */
  created: number;
  /** Works already in the library — skipped by duplicate check. */
  skipped: number;
  /** Works that failed due to a network or parse error. */
  failed: number;
  /** Works requiring AO3 login (restricted). */
  restricted: number;
  /** Title of the work currently being processed. Null between works. */
  currentTitle: string | null;
}

export type OnImportProgress = (progress: ImportProgress) => void;

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Processes an array of canonical AO3 work URLs sequentially.
 *
 * Per-URL flow:
 *   1. Duplicate check via findReadableBySourceId — skip if found.
 *   2. fetchAo3Metadata — detect restricted / total failure.
 *   3. createReadable with status='want_to_read', progressCurrent=null.
 *   4. onProgress callback.
 *   5. ao3RateLimitDelay (skipped after the last URL).
 *
 * @param db         Database instance from useDatabase().
 * @param urls       Canonical AO3 work URLs (already validated by csvParser).
 * @param onProgress Callback fired after each URL is resolved.
 */
export async function runImportPipeline(
  db: SQLiteDatabase,
  urls: string[],
  onProgress: OnImportProgress,
): Promise<ImportProgress> {
  const total = urls.length;
  let completed = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let restricted = 0;

  for (let i = 0; i < urls.length; i++) {
    const canonicalUrl = urls[i];

    // Rate-limit: pause before every fetch except the first
    if (i > 0) await ao3RateLimitDelay();

    let currentTitle: string | null = null;

    try {
      // processAo3Url should never return null here (csvParser pre-validated),
      // but guard defensively to avoid a silent undefined error.
      const processed = processAo3Url(canonicalUrl);
      if (!processed) {
        failed++;
        completed++;
        onProgress({ total, completed, created, skipped, failed, restricted, currentTitle });
        continue;
      }

      const { workId } = processed;

      // Duplicate check: already in library?
      const existing = await findReadableBySourceId(db, workId, 'ao3');
      if (existing !== null) {
        skipped++;
        completed++;
        onProgress({
          total, completed, created, skipped, failed, restricted,
          currentTitle: existing.title,
        });
        continue;
      }

      // Fetch AO3 metadata
      const result = await fetchAo3Metadata(canonicalUrl);
      const fetched = result.data;

      // Restricted: work requires AO3 login
      if (result.isRestricted === true) {
        restricted++;
        completed++;
        onProgress({ total, completed, created, skipped, failed, restricted, currentTitle });
        continue;
      }

      // Total failure: errors present and no usable title
      if (result.errors.length > 0 && !fetched.title) {
        failed++;
        completed++;
        onProgress({ total, completed, created, skipped, failed, restricted, currentTitle });
        continue;
      }

      currentTitle = fetched.title ?? null;

      // Map ImportedMetadata → CreateReadableInput.
      // progressCurrent is always null for imports — it is the user's reading
      // position and must only be set by the user (§6 AO3 chapter count mapping).
      const input: CreateReadableInput = {
        kind: 'fanfic',
        sourceType: 'ao3',
        status: 'want_to_read',
        title: fetched.title ?? 'Untitled',
        author: fetched.author ?? null,
        summary: fetched.summary ?? null,
        tags: fetched.tags ?? [],
        progressCurrent: null,
        totalUnits: fetched.totalUnits ?? null,
        isComplete: fetched.isComplete ?? null,
        sourceUrl: fetched.sourceUrl ?? canonicalUrl,
        sourceId: workId,
        availableChapters: fetched.availableChapters ?? null,
        wordCount: fetched.wordCount ?? null,
        fandom: fetched.fandom ?? [],
        relationships: fetched.relationships ?? [],
        rating: fetched.rating ?? null,
        archiveWarnings: fetched.archiveWarnings ?? [],
        isAbandoned: fetched.isAbandoned ?? false,
        authorType: fetched.authorType ?? null,
        publishedAt: fetched.publishedAt ?? null,
        ao3UpdatedAt: fetched.ao3UpdatedAt ?? null,
        seriesName: fetched.seriesName ?? null,
        seriesPart: fetched.seriesPart ?? null,
        seriesTotal: fetched.seriesTotal ?? null,
      };

      await createReadable(db, input);
      created++;
      completed++;
      onProgress({ total, completed, created, skipped, failed, restricted, currentTitle });
    } catch {
      // Per-work error — log and continue the batch
      failed++;
      completed++;
      onProgress({ total, completed, created, skipped, failed, restricted, currentTitle });
    }
  }

  return { total, completed, created, skipped, failed, restricted, currentTitle: null };
}
