// src/features/readables/services/readableRepository.ts
import { getAllAsync, getFirstAsync, runAsync } from '@src/db/sqlite';
import type {
  ReadableItem,
  BookReadable,
  FanficReadable,
  ReadableStatus,
  Ao3Rating,
  ReadableType,
} from '../types';
import type { MoodTag } from '@src/features/moods/types';
import type { ReadableRow } from '@src/db/schema/readables.schema';

/**
 * Generate a simple unique ID. Good enough for local-only data.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Helper: pick earliest valid ISO-ish date string from a list.
 */
function pickEarliestDateString(values: Array<string | null | undefined>): string | null {
  const timestamps: number[] = [];

  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) {
      timestamps.push(t);
    }
  }

  if (timestamps.length === 0) return null;

  const earliest = Math.min(...timestamps);
  return new Date(earliest).toISOString();
}

interface CreatedAtRecalculationInput {
  existingCreatedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  dnfAt?: string | null;
}

/**
 * Ensure createdAt is never later than any of the reading dates.
 * - If there are backdated started/finished/dnf dates, createdAt
 *   becomes the earliest of them (or stays as-is if it's already earlier).
 * - If nothing is set, falls back to "now".
 */
function computeCreatedAt({
  existingCreatedAt,
  startedAt,
  finishedAt,
  dnfAt,
}: CreatedAtRecalculationInput): string {
  const earliest = pickEarliestDateString([
    existingCreatedAt ?? null,
    startedAt ?? null,
    finishedAt ?? null,
    dnfAt ?? null,
  ]);

  if (earliest) {
    return earliest;
  }

  // Fallback: nothing to go on, use now.
  return new Date().toISOString();
}

/**
 * Normalise chapter fields from a DB row into AO3-style semantics.
 * This mirrors the logic in readableRowMapper so everything stays consistent.
 */
function normaliseFanficChapterDataFromRow(row: ReadableRow): {
  chapterCount: number | null;
  availableChapters: number | null;
  totalChapters: number | null;
  complete: boolean | null;
  currentChapter: number | null;
} {
  const isComplete = row.is_complete == null ? null : row.is_complete === 1;

  let legacyCount: number | null = row.chapter_count;
  let available: number | null = row.available_chapters;
  let total: number | null = row.total_chapters;

  // Case 1: no explicit available/total, but we have a legacy count
  if (available == null && total == null && legacyCount != null) {
    if (isComplete) {
      available = legacyCount;
      total = legacyCount;
    } else {
      available = legacyCount;
      total = null;
    }
  }
  // Case 2: total set, available missing
  else if (available == null && total != null) {
    if (isComplete) {
      // Completed work, total is definitive → X/X
      available = total;
    } else if (legacyCount != null && total === legacyCount) {
      // New AO3 behaviour: parser gave us "current" only, and older writer
      // stored it into both chapter_count and total_chapters. Interpret as X/?.
      available = legacyCount;
      total = null;
    }
    // Else: ambiguous older data: we only know total → ?/total
  }

  const currentChapter = row.current_chapter ?? null;

  return {
    chapterCount: legacyCount,
    availableChapters: available,
    totalChapters: total,
    complete: isComplete,
    currentChapter,
  };
}

/**
 * Map a DB row into a domain ReadableItem.
 */
function mapRowToReadable(row: ReadableRow): ReadableItem {
  const moodTags: MoodTag[] = row.mood_tags_json
    ? (JSON.parse(row.mood_tags_json) as MoodTag[])
    : [];

  const progressPercent = row.progress_percent ?? 0;

  const base = {
    id: row.id,
    type: row.type,
    title: row.title,
    author: row.author,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    progressPercent,
    moodTags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    dnfAt: row.dnf_at ?? null,
    notes: row.notes ?? null,
    timeCurrentSeconds: row.time_current_seconds ?? null,
    timeTotalSeconds: row.time_total_seconds ?? null,
  } as const;

  if (row.type === 'book') {
    const genres: string[] = row.genres_json ? (JSON.parse(row.genres_json) as string[]) : [];

    const book: BookReadable = {
      ...base,
      type: 'book',
      source: (row.source as BookReadable['source']) ?? 'manual',
      sourceId: row.source_id ?? null,
      pageCount: row.page_count ?? null,
      currentPage: row.current_page ?? null,
      genres,
    };

    return book;
  }

  // fanfic
  const fandoms: string[] = row.fandoms_json ? (JSON.parse(row.fandoms_json) as string[]) : [];
  const relationships: string[] = row.relationships_json
    ? (JSON.parse(row.relationships_json) as string[])
    : [];
  const characters: string[] = row.characters_json
    ? (JSON.parse(row.characters_json) as string[])
    : [];
  const ao3Tags: string[] = row.ao3_tags_json ? (JSON.parse(row.ao3_tags_json) as string[]) : [];
  const warnings: string[] = row.warnings_json ? (JSON.parse(row.warnings_json) as string[]) : [];

  // DB stores rating as string | null, we trust it's one of the Ao3Rating values.
  const rating = (row.rating as Ao3Rating | null) ?? null;

  const { chapterCount, availableChapters, totalChapters, complete, currentChapter } =
    normaliseFanficChapterDataFromRow(row);

  const fanfic: FanficReadable = {
    ...base,
    type: 'fanfic',
    source: 'ao3',
    ao3WorkId: row.ao3_work_id ?? '',
    ao3Url: row.ao3_url ?? '',
    fandoms,
    relationships,
    characters,
    ao3Tags,
    rating,
    warnings,
    chapterCount,
    currentChapter,
    availableChapters,
    totalChapters,
    complete,
    wordCount: row.word_count ?? null,
  };

  return fanfic;
}

/**
 * Build a row from a full domain readable.
 */
function buildRowFromReadable(readable: ReadableItem): ReadableRow {
  const isBook = readable.type === 'book';
  const isFanfic = readable.type === 'fanfic';

  const book = isBook ? (readable as BookReadable) : null;
  const fanfic = isFanfic ? (readable as FanficReadable) : null;

  let chapter_count: number | null = null;
  let current_chapter: number | null = null;
  let available_chapters: number | null = null;
  let total_chapters: number | null = null;
  let is_complete: number | null = null;

  if (fanfic) {
    const legacyCount: number | null = fanfic.chapterCount ?? null;
    let available: number | null = fanfic.availableChapters ?? null;
    let total: number | null = fanfic.totalChapters ?? null;
    const complete = fanfic.complete ?? null;

    // If we only have a single legacy number, interpret it based on completeness.
    if (available == null && total == null && legacyCount != null) {
      if (complete) {
        available = legacyCount;
        total = legacyCount;
      } else {
        available = legacyCount;
        total = null;
      }
    } else if (available != null && total == null && complete) {
      // Complete but only "available" specified → treat as X/X
      total = available;
    }

    chapter_count = total ?? legacyCount ?? available ?? null;
    current_chapter = fanfic.currentChapter ?? null;
    available_chapters = available;
    total_chapters = total;
    is_complete = complete == null ? null : complete ? 1 : 0;
  }

  return {
    id: readable.id,
    type: readable.type,
    title: readable.title,
    author: readable.author,
    description: readable.description ?? null,
    status: readable.status,
    priority: readable.priority,
    source: isBook ? book!.source : 'ao3',
    source_id: isBook ? (book!.sourceId ?? null) : null,
    page_count: isBook ? (book!.pageCount ?? null) : null,
    current_page: isBook ? (book!.currentPage ?? null) : null,
    ao3_work_id: isFanfic ? fanfic!.ao3WorkId : null,
    ao3_url: isFanfic ? fanfic!.ao3Url : null,
    fandoms_json: isFanfic ? JSON.stringify(fanfic!.fandoms) : null,
    relationships_json: isFanfic ? JSON.stringify(fanfic!.relationships) : null,
    characters_json: isFanfic ? JSON.stringify(fanfic!.characters) : null,
    ao3_tags_json: isFanfic ? JSON.stringify(fanfic!.ao3Tags) : null,
    rating: isFanfic ? (fanfic!.rating ?? null) : null,
    warnings_json: isFanfic ? JSON.stringify(fanfic!.warnings) : null,
    chapter_count,
    current_chapter,
    available_chapters,
    total_chapters,
    is_complete,
    word_count: isFanfic ? (fanfic!.wordCount ?? null) : null,
    genres_json: isBook ? JSON.stringify(book!.genres) : null,
    mood_tags_json: JSON.stringify(readable.moodTags ?? []),
    created_at: readable.createdAt,
    updated_at: readable.updatedAt,
    started_at: readable.startedAt ?? null,
    finished_at: readable.finishedAt ?? null,
    dnf_at: readable.dnfAt ?? null,
    notes: readable.notes ?? null,
    progress_percent: readable.progressPercent ?? 0,
    time_current_seconds: readable.timeCurrentSeconds ?? null,
    time_total_seconds: readable.timeTotalSeconds ?? null,
  };
}

/**
 * Build a row from a "new" readable that doesn't have id/createdAt/updatedAt yet.
 */
function buildRowFromNewReadable(
  readable: Omit<ReadableItem, 'id' | 'createdAt' | 'updatedAt'>,
): ReadableRow {
  const now = new Date().toISOString();

  // Respect any explicit dates coming in; otherwise derive from status.
  let startedAt: string | null = readable.startedAt ?? null;
  let finishedAt: string | null = readable.finishedAt ?? null;
  let dnfAt: string | null = readable.dnfAt ?? null;

  switch (readable.status) {
    case 'reading':
      if (!startedAt) startedAt = now;
      break;
    case 'finished':
      if (!finishedAt) finishedAt = now;
      break;
    case 'DNF':
      if (!dnfAt) dnfAt = now;
      break;
    case 'to-read':
    default:
      break;
  }

  const createdAt = computeCreatedAt({
    existingCreatedAt: now, // baseline "added now", pulled back if dates are earlier
    startedAt,
    finishedAt,
    dnfAt,
  });

  const withMeta: ReadableItem = {
    ...(readable as ReadableItem),
    id: generateId(),
    createdAt,
    updatedAt: now,
    startedAt,
    finishedAt,
    dnfAt,
  };
  return buildRowFromReadable(withMeta);
}

/**
 * Items still in the queue (to-read only), ordered by priority and recency.
 */
async function getAllToRead(): Promise<ReadableItem[]> {
  const rows = await getAllAsync<ReadableRow>(
    `
    SELECT *
    FROM readables
    WHERE status = ?
    ORDER BY priority DESC, created_at DESC;
  `,
    ['to-read'],
  );

  return rows.map(mapRowToReadable);
}

/**
 * All readables, regardless of status.
 */
async function getAll(): Promise<ReadableItem[]> {
  const rows = await getAllAsync<ReadableRow>(
    `
    SELECT *
    FROM readables
    ORDER BY created_at DESC;
  `,
  );

  return rows.map(mapRowToReadable);
}

/**
 * Only finished readables, newest completions first.
 */
async function getAllFinished(): Promise<ReadableItem[]> {
  const rows = await getAllAsync<ReadableRow>(
    `
    SELECT *
    FROM readables
    WHERE status = ?
    ORDER BY updated_at DESC;
  `,
    ['finished'],
  );

  return rows.map(mapRowToReadable);
}

async function getById(id: string): Promise<ReadableItem | null> {
  const row = await getFirstAsync<ReadableRow>(
    `
    SELECT *
    FROM readables
    WHERE id = ?
    LIMIT 1;
  `,
    [id],
  );

  return row ? mapRowToReadable(row) : null;
}

async function insert(
  readable: Omit<ReadableItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ReadableItem> {
  const row = buildRowFromNewReadable(readable);

  // 36 columns, 36 values. Must stay in sync with the table definition + migrations.
  await runAsync(
    `
    INSERT INTO readables (
      id,
      type,
      title,
      author,
      description,
      status,
      priority,
      source,
      source_id,
      page_count,
      current_page,
      ao3_work_id,
      ao3_url,
      fandoms_json,
      relationships_json,
      characters_json,
      ao3_tags_json,
      rating,
      warnings_json,
      chapter_count,
      current_chapter,
      available_chapters,
      total_chapters,
      is_complete,
      word_count,
      genres_json,
      mood_tags_json,
      created_at,
      updated_at,
      progress_percent,
      time_current_seconds,
      time_total_seconds,
      started_at,
      finished_at,
      dnf_at,
      notes
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    );
  `,
    [
      row.id,
      row.type,
      row.title,
      row.author,
      row.description,
      row.status,
      row.priority,
      row.source,
      row.source_id,
      row.page_count,
      row.current_page,
      row.ao3_work_id,
      row.ao3_url,
      row.fandoms_json,
      row.relationships_json,
      row.characters_json,
      row.ao3_tags_json,
      row.rating,
      row.warnings_json,
      row.chapter_count,
      row.current_chapter,
      row.available_chapters,
      row.total_chapters,
      row.is_complete,
      row.word_count,
      row.genres_json,
      row.mood_tags_json,
      row.created_at,
      row.updated_at,
      row.progress_percent,
      row.time_current_seconds,
      row.time_total_seconds,
      row.started_at,
      row.finished_at,
      row.dnf_at,
      row.notes,
    ],
  );

  return mapRowToReadable(row);
}

async function update(readable: ReadableItem): Promise<ReadableItem> {
  const existing = await getById(readable.id);
  if (!existing) {
    throw new Error(`Readable with id ${readable.id} not found`);
  }

  const now = new Date().toISOString();

  // Caller sends a full object with updated fields.
  const merged: ReadableItem = {
    ...existing,
    ...readable,
    updatedAt: now,
  };

  const createdAt = computeCreatedAt({
    existingCreatedAt: existing.createdAt,
    startedAt: merged.startedAt ?? null,
    finishedAt: merged.finishedAt ?? null,
    dnfAt: merged.dnfAt ?? null,
  });

  const final: ReadableItem = {
    ...merged,
    createdAt,
    updatedAt: now,
  };

  const row = buildRowFromReadable(final);

  await runAsync(
    `
    UPDATE readables
    SET
      type = ?,
      title = ?,
      author = ?,
      description = ?,
      status = ?,
      priority = ?,
      source = ?,
      source_id = ?,
      page_count = ?,
      current_page = ?,
      ao3_work_id = ?,
      ao3_url = ?,
      fandoms_json = ?,
      relationships_json = ?,
      characters_json = ?,
      ao3_tags_json = ?,
      rating = ?,
      warnings_json = ?,
      chapter_count = ?,
      current_chapter = ?,
      available_chapters = ?,
      total_chapters = ?,
      is_complete = ?,
      word_count = ?,
      genres_json = ?,
      mood_tags_json = ?,
      progress_percent = ?,
      time_current_seconds = ?,
      time_total_seconds = ?,
      started_at = ?,
      finished_at = ?,
      dnf_at = ?,
      notes = ?,
      created_at = ?,
      updated_at = ?
    WHERE id = ?;
  `,
    [
      row.type,
      row.title,
      row.author,
      row.description,
      row.status,
      row.priority,
      row.source,
      row.source_id,
      row.page_count,
      row.current_page,
      row.ao3_work_id,
      row.ao3_url,
      row.fandoms_json,
      row.relationships_json,
      row.characters_json,
      row.ao3_tags_json,
      row.rating,
      row.warnings_json,
      row.chapter_count,
      row.current_chapter,
      row.available_chapters,
      row.total_chapters,
      row.is_complete,
      row.word_count,
      row.genres_json,
      row.mood_tags_json,
      row.progress_percent,
      row.time_current_seconds,
      row.time_total_seconds,
      row.started_at,
      row.finished_at,
      row.dnf_at,
      row.notes,
      row.created_at,
      row.updated_at,
      row.id,
    ],
  );

  return final;
}

async function remove(id: string): Promise<void> {
  await runAsync(
    `
    DELETE FROM readables
    WHERE id = ?;
  `,
    [id],
  );
}

/**
 * Simple status update helper, also bumps updated_at.
 * When you mark as finished, this timestamp becomes your "finished at" date.
 *
 * Semantics:
 * - finished: also sets progress_percent = 100 and finished_at (if not already set)
 * - reading: sets started_at if not already set
 * - DNF: sets dnf_at if not already set
 * - to-read: leaves timestamps as-is (we preserve history)
 */
async function updateStatus(id: string, status: ReadableStatus): Promise<void> {
  const now = new Date().toISOString();

  const existing = await getById(id);
  if (!existing) {
    throw new Error(`Readable with id ${id} not found`);
  }

  let progressPercent = existing.progressPercent ?? 0;
  let startedAt = existing.startedAt ?? null;
  let finishedAt = existing.finishedAt ?? null;
  let dnfAt = existing.dnfAt ?? null;

  switch (status) {
    case 'reading':
      if (!startedAt) {
        startedAt = now;
      }
      break;
    case 'finished':
      progressPercent = 100;
      if (!finishedAt) {
        finishedAt = now;
      }
      break;
    case 'DNF':
      if (!dnfAt) {
        dnfAt = now;
      }
      break;
    case 'to-read':
    default:
      // leave timestamps + progress as-is
      break;
  }

  await runAsync(
    `
    UPDATE readables
    SET
      status = ?,
      updated_at = ?,
      progress_percent = ?,
      started_at = ?,
      finished_at = ?,
      dnf_at = ?
    WHERE id = ?;
  `,
    [status, now, progressPercent, startedAt, finishedAt, dnfAt, id],
  );
}

/**
 * Legacy: update reading progress (0–100) directly and bump updated_at.
 * Kept for callers that still think in percentages.
 */
async function updateProgress(id: string, progressPercent: number): Promise<void> {
  const clamped = Math.min(100, Math.max(0, Math.round(progressPercent)));
  const now = new Date().toISOString();

  await runAsync(
    `
    UPDATE readables
    SET progress_percent = ?, updated_at = ?
    WHERE id = ?;
  `,
    [clamped, now, id],
  );
}

async function updateProgressByUnits(args: {
  id: string;
  type: ReadableType;
  currentUnit: number;
}): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getById(args.id);
  if (!existing) {
    throw new Error(`Readable with id ${args.id} not found`);
  }

  const value = Number.isFinite(args.currentUnit) ? Math.max(0, Math.round(args.currentUnit)) : 0;

  // ---- Books: page-based progress ----
  if (args.type === 'book') {
    const book = existing as BookReadable;
    const totalPages = book.pageCount ?? null;
    const clampedPage = totalPages != null && totalPages > 0 ? Math.min(value, totalPages) : value;

    let progressPercent = book.progressPercent ?? 0;

    if (totalPages != null && totalPages > 0 && clampedPage >= 0) {
      progressPercent = Math.max(0, Math.min(100, Math.round((clampedPage / totalPages) * 100)));
    }

    await runAsync(
      `
      UPDATE readables
      SET current_page = ?, progress_percent = ?, updated_at = ?
      WHERE id = ?;
    `,
      [clampedPage, progressPercent, now, args.id],
    );
    return;
  }

  // ---- Fanfic: chapter-based progress ----
  const fanfic = existing as FanficReadable;

  const denominator =
    fanfic.totalChapters != null && fanfic.totalChapters > 0
      ? fanfic.totalChapters
      : fanfic.availableChapters != null && fanfic.availableChapters > 0
        ? fanfic.availableChapters
        : fanfic.chapterCount != null && fanfic.chapterCount > 0
          ? fanfic.chapterCount
          : null;

  const maxAllowed = denominator ?? value;
  const clampedChapter = Math.min(value, maxAllowed);

  let progressPercent = fanfic.progressPercent ?? 0;

  if (denominator != null && denominator > 0) {
    progressPercent = Math.max(0, Math.min(100, Math.round((clampedChapter / denominator) * 100)));
  }

  await runAsync(
    `
    UPDATE readables
    SET current_chapter = ?, progress_percent = ?, updated_at = ?
    WHERE id = ?;
  `,
    [clampedChapter, progressPercent, now, args.id],
  );
}

// Time-based progress update: take current/total seconds, derive percent, store percent only.
async function updateProgressByTime(params: {
  id: string;
  currentSeconds: number;
  totalSeconds: number;
}): Promise<void> {
  const { id, currentSeconds, totalSeconds } = params;

  const nowIso = new Date().toISOString();

  let percent = 0;

  const safeTotal = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;

  if (safeTotal > 0 && Number.isFinite(currentSeconds) && currentSeconds > 0) {
    const clampedCurrent = Math.min(Math.max(currentSeconds, 0), safeTotal);
    percent = Math.round((clampedCurrent / safeTotal) * 100);
  }

  // Clamp final percent to [0, 100]
  if (!Number.isFinite(percent) || percent < 0) percent = 0;
  if (percent > 100) percent = 100;

  await runAsync(
    `
      UPDATE readables
      SET
        progress_percent = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [percent, nowIso, id],
  );
}

/**
 * Update notes (review / DNF reasoning) and bump updated_at.
 */
async function updateNotes(id: string, notes: string | null): Promise<void> {
  const now = new Date().toISOString();

  await runAsync(
    `
    UPDATE readables
    SET notes = ?, updated_at = ?
    WHERE id = ?;
  `,
    [notes, now, id],
  );
}

export const readableRepository = {
  getAllToRead,
  getAll,
  getAllFinished,
  getById,
  insert,
  update,
  updateStatus,
  updateProgress,
  updateProgressByUnits,
  updateProgressByTime,
  updateNotes,
  delete: remove,
};
