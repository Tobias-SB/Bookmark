// src/features/readables/services/readableMapper.ts
import type { ReadableRow } from '../../../db/schema/readables.schema';
import type { BookReadable, FanficReadable, ReadableItem, BookSource, Ao3Rating } from '../types';
import type { MoodTag } from '../../../db/schema/moods.schema';

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    return [];
  } catch {
    return [];
  }
}

function stringifyJsonArray(value: unknown[]): string {
  return JSON.stringify(value);
}

function parseMoodTags(value: string | null): MoodTag[] {
  return parseJsonArray<MoodTag>(value);
}

/**
 * Normalise chapter fields from a DB row into AO3-style semantics:
 *
 * - availableChapters: chapters currently posted (left side of "X/Y")
 * - totalChapters: planned total chapters (right side), or null when unknown/"?"
 * - chapterCount: legacy "total chapters" (kept for backwards compatibility)
 *
 * Rules (in order):
 * 1. If we have explicit available/total, trust them.
 * 2. If neither available nor total is set but chapter_count is:
 *    - if complete: treat as X/X
 *    - else: treat as X/? (available only)
 * 3. If total is set but available is not:
 *    - if complete: available = total (X/X)
 *    - else if chapter_count == total: treat as X/? (new AO3 parser stored "current" in both)
 *    - else: treat as ?/total (we only know total)
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

export function mapReadableRowToDomain(row: ReadableRow): ReadableItem {
  const moodTags: MoodTag[] = parseMoodTags(row.mood_tags_json);

  const progressPercent = row.progress_percent ?? 0;

  const base = {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    moodTags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressPercent,
    timeCurrentSeconds: row.time_current_seconds ?? null,
    timeTotalSeconds: row.time_total_seconds ?? null,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    dnfAt: row.dnf_at ?? null,
    notes: row.notes ?? null,
  } as const;

  if (row.type === 'book') {
    const genres: string[] = parseJsonArray<string>(row.genres_json);

    const book: BookReadable = {
      ...base,
      type: 'book',
      source: (row.source ?? 'manual') as BookSource,
      sourceId: row.source_id,
      pageCount: row.page_count,
      currentPage: row.current_page ?? null,
      genres,
    };
    return book;
  }

  // fanfic
  const fandoms: string[] = parseJsonArray<string>(row.fandoms_json);
  const relationships: string[] = parseJsonArray<string>(row.relationships_json);
  const characters: string[] = parseJsonArray<string>(row.characters_json);
  const ao3Tags: string[] = parseJsonArray<string>(row.ao3_tags_json);
  const warnings: string[] = parseJsonArray<string>(row.warnings_json);

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
    availableChapters,
    totalChapters,
    currentChapter,
    complete,
    wordCount: row.word_count,
  };

  return fanfic;
}

interface BuildRowOptions {
  now?: string;
}

/**
 * Build a ReadableRow ready for INSERT/UPDATE from a domain model.
 *
 * For fanfic:
 * - availableChapters: chapters currently posted
 * - totalChapters: planned total, null when unknown
 * - chapterCount: legacy single-number field kept mainly for backwards compatibility
 */
export function buildReadableRowFromDomain(
  readable: ReadableItem,
  options: BuildRowOptions = {},
): ReadableRow {
  const now = options.now ?? new Date().toISOString();

  const base: Omit<ReadableRow, 'type'> = {
    id: readable.id,
    title: readable.title,
    author: readable.author,
    description: readable.description ?? null,
    status: readable.status,
    priority: readable.priority,
    source: null,
    source_id: null,
    page_count: null,
    current_page: null,
    ao3_work_id: null,
    ao3_url: null,
    fandoms_json: null,
    relationships_json: null,
    characters_json: null,
    ao3_tags_json: null,
    rating: null,
    warnings_json: null,
    chapter_count: null,
    current_chapter: null,
    available_chapters: null,
    total_chapters: null,
    is_complete: null,
    word_count: null,
    genres_json: null,
    mood_tags_json: stringifyJsonArray(readable.moodTags),
    created_at: readable.createdAt || now,
    updated_at: now,
    started_at: readable.startedAt ?? null,
    finished_at: readable.finishedAt ?? null,
    dnf_at: readable.dnfAt ?? null,
    notes: readable.notes ?? null,
    progress_percent: readable.progressPercent ?? 0,
    time_current_seconds: readable.timeCurrentSeconds ?? null,
    time_total_seconds: readable.timeTotalSeconds ?? null,
  };

  if (readable.type === 'book') {
    const book = readable as BookReadable;
    return {
      ...base,
      type: 'book',
      source: book.source,
      source_id: book.sourceId ?? null,
      page_count: book.pageCount ?? null,
      current_page: book.currentPage ?? null,
      genres_json: stringifyJsonArray(book.genres),
    };
  }

  const fanfic = readable as FanficReadable;

  const legacyCount: number | null = fanfic.chapterCount ?? null;
  let available: number | null = fanfic.availableChapters ?? null;
  let total: number | null = fanfic.totalChapters ?? null;
  const isComplete = fanfic.complete ?? null;

  // If we only have a single legacy number, interpret it based on completeness.
  if (available == null && total == null && legacyCount != null) {
    if (isComplete) {
      available = legacyCount;
      total = legacyCount;
    } else {
      available = legacyCount;
      total = null;
    }
  } else if (available != null && total == null && isComplete) {
    // Complete but only "available" specified → treat as X/X
    total = available;
  }

  const chapterCountToStore = total ?? legacyCount ?? available ?? null;

  return {
    ...base,
    type: 'fanfic',
    source: 'ao3',
    ao3_work_id: fanfic.ao3WorkId,
    ao3_url: fanfic.ao3Url,
    fandoms_json: stringifyJsonArray(fanfic.fandoms),
    relationships_json: stringifyJsonArray(fanfic.relationships),
    characters_json: stringifyJsonArray(fanfic.characters),
    ao3_tags_json: stringifyJsonArray(fanfic.ao3Tags),
    rating: fanfic.rating ?? null,
    warnings_json: stringifyJsonArray(fanfic.warnings),
    chapter_count: chapterCountToStore,
    current_chapter: fanfic.currentChapter ?? null,
    available_chapters: available,
    total_chapters: total,
    is_complete: isComplete == null ? null : isComplete ? 1 : 0,
    word_count: fanfic.wordCount ?? null,
  };
}
