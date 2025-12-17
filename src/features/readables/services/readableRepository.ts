import { getAllAsync, getFirstAsync, runAsync } from '@src/db/sqlite';
import type {
  ReadableItem,
  BookReadable,
  FanficReadable,
  ReadableStatus,
  Ao3Rating,
  ReadableType,
  ProgressMode,
} from '../types';
import type { MoodTag } from '@src/features/moods/types';
import type { ReadableRow } from '@src/db/schema/readables.schema';

/**
 * Generate a simple unique ID. Good enough for local-only data.
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseProgressMode(value: unknown): ProgressMode {
  if (value === 'units' || value === 'time' || value === 'percent') return value;
  return 'units';
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

  return new Date().toISOString();
}

/**
 * Normalise fanfic chapter fields from a DB row into AO3-style semantics.
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

  if (available == null && total == null && legacyCount != null) {
    if (isComplete) {
      available = legacyCount;
      total = legacyCount;
    } else {
      available = legacyCount;
      total = null;
    }
  } else if (available == null && total != null) {
    if (isComplete) {
      available = total;
    } else if (legacyCount != null && total === legacyCount) {
      available = legacyCount;
      total = null;
    }
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
    progressMode: normaliseProgressMode((row as any).progress_mode),
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

  const fandoms: string[] = row.fandoms_json ? (JSON.parse(row.fandoms_json) as string[]) : [];
  const relationships: string[] = row.relationships_json
    ? (JSON.parse(row.relationships_json) as string[])
    : [];
  const characters: string[] = row.characters_json
    ? (JSON.parse(row.characters_json) as string[])
    : [];
  const ao3Tags: string[] = row.ao3_tags_json ? (JSON.parse(row.ao3_tags_json) as string[]) : [];
  const warnings: string[] = row.warnings_json ? (JSON.parse(row.warnings_json) as string[]) : [];

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

    if (available == null && total == null && legacyCount != null) {
      if (complete) {
        available = legacyCount;
        total = legacyCount;
      } else {
        available = legacyCount;
        total = null;
      }
    } else if (available != null && total == null && complete) {
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
    progress_mode: readable.progressMode ?? 'units',
  };
}

/**
 * Build a row from a "new" readable that doesn't have id/createdAt/updatedAt yet.
 */
function buildRowFromNewReadable(
  readable: Omit<ReadableItem, 'id' | 'createdAt' | 'updatedAt'>,
): ReadableRow {
  const now = new Date().toISOString();

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
    default:
      break;
  }

  const createdAt = computeCreatedAt({
    existingCreatedAt: now,
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
    progressMode: readable.progressMode ?? 'units',
  };

  return buildRowFromReadable(withMeta);
}

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

  // 37 columns, 37 values.
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
      progress_mode,
      started_at,
      finished_at,
      dnf_at,
      notes
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      row.progress_mode,
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
      progress_mode = ?,
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
      row.progress_mode,
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
 * Status update helper, also bumps updated_at.
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
      if (!startedAt) startedAt = now;
      break;
    case 'finished':
      progressPercent = 100;
      if (!finishedAt) finishedAt = now;
      break;
    case 'DNF':
      if (!dnfAt) dnfAt = now;
      break;
    default:
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
 * Update progress mode and bump updated_at.
 */
async function updateProgressMode(id: string, progressMode: ProgressMode): Promise<void> {
  const now = new Date().toISOString();
  const mode = normaliseProgressMode(progressMode);

  await runAsync(
    `
    UPDATE readables
    SET progress_mode = ?, updated_at = ?
    WHERE id = ?;
  `,
    [mode, now, id],
  );
}

/**
 * Update reading progress (0–100) directly and bump updated_at.
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

/**
 * Set book total pages (used when missing and user provides it from progress UI).
 * This does NOT change current_page; it only sets the total.
 */
async function setBookPageCount(id: string, pageCount: number): Promise<void> {
  const now = new Date().toISOString();
  const value = Number.isFinite(pageCount) ? Math.max(1, Math.round(pageCount)) : 1;

  await runAsync(
    `
    UPDATE readables
    SET page_count = ?, updated_at = ?
    WHERE id = ?;
  `,
    [value, now, id],
  );
}

/**
 * Set fanfic total chapters (used when missing and user provides it from progress UI).
 */
async function setFanficTotalChapters(id: string, totalChapters: number): Promise<void> {
  const now = new Date().toISOString();
  const value = Number.isFinite(totalChapters) ? Math.max(1, Math.round(totalChapters)) : 1;

  await runAsync(
    `
    UPDATE readables
    SET total_chapters = ?, updated_at = ?
    WHERE id = ?;
  `,
    [value, now, id],
  );
}

/**
 * Set total time seconds (editable in EditReadableScreen).
 */
async function setTimeTotalSeconds(id: string, totalSeconds: number | null): Promise<void> {
  const now = new Date().toISOString();

  let value: number | null = null;
  if (totalSeconds != null) {
    const n = Number.isFinite(totalSeconds) ? Math.max(1, Math.round(totalSeconds)) : null;
    value = n;
  }

  await runAsync(
    `
    UPDATE readables
    SET time_total_seconds = ?, updated_at = ?
    WHERE id = ?;
  `,
    [value, now, id],
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

  if (args.type === 'book') {
    const book = existing as BookReadable;
    const totalPages = book.pageCount ?? null;
    const clampedPage = totalPages != null && totalPages > 0 ? Math.min(value, totalPages) : value;

    let progressPercent = book.progressPercent ?? 0;

    if (totalPages != null && totalPages > 0) {
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

/**
 * Fully persistent time progress update.
 * - Always stores time_current_seconds
 * - Stores time_total_seconds only if provided AND (existing total is null OR payload explicitly says to overwrite via Edit screen using setTimeTotalSeconds)
 * - Updates progress_percent if total exists and > 0
 */
async function updateProgressByTime(params: {
  id: string;
  currentSeconds: number;
  totalSeconds?: number | null;
}): Promise<void> {
  const now = new Date().toISOString();

  const existing = await getById(params.id);
  if (!existing) {
    throw new Error(`Readable with id ${params.id} not found`);
  }

  const currentRaw = Number.isFinite(params.currentSeconds)
    ? Math.max(0, Math.round(params.currentSeconds))
    : 0;

  const existingTotal = existing.timeTotalSeconds ?? null;

  // In the progress editor, total is only editable if missing, so we respect that:
  // if existing total exists -> ignore payload total
  // if missing -> accept provided total
  let finalTotal: number | null = existingTotal;

  if (finalTotal == null && params.totalSeconds != null) {
    const n = Number.isFinite(params.totalSeconds)
      ? Math.max(1, Math.round(params.totalSeconds))
      : null;
    finalTotal = n;
  }

  const clampedCurrent =
    finalTotal != null && finalTotal > 0 ? Math.min(currentRaw, finalTotal) : currentRaw;

  let percent = existing.progressPercent ?? 0;
  if (finalTotal != null && finalTotal > 0) {
    percent = Math.round((clampedCurrent / finalTotal) * 100);
    percent = Math.max(0, Math.min(100, percent));
  }

  await runAsync(
    `
    UPDATE readables
    SET
      time_current_seconds = ?,
      time_total_seconds = ?,
      progress_percent = ?,
      updated_at = ?
    WHERE id = ?;
  `,
    [clampedCurrent, finalTotal, percent, now, params.id],
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
  updateProgressMode,
  updateProgress,
  updateProgressByUnits,
  updateProgressByTime,
  setBookPageCount,
  setFanficTotalChapters,
  setTimeTotalSeconds,
  updateNotes,
  delete: remove,
};
