import type { ReadableRow, ProgressMode } from '../../../db/schema/readables.schema';
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

function normaliseProgressMode(value: unknown): ProgressMode {
  if (value === 'units' || value === 'time' || value === 'percent') {
    return value;
  }
  return 'units';
}

/**
 * Normalise chapter fields from a DB row into AO3-style semantics.
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
    progressMode: normaliseProgressMode(row.progress_mode),
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

  const fandoms: string[] = parseJsonArray<string>(row.fandoms_json);
  const relationships: string[] = parseJsonArray<string>(row.relationships_json);
  const characters: string[] = parseJsonArray<string>(row.characters_json);
  const ao3Tags: string[] = parseJsonArray<string>(row.ao3_tags_json);
  const warnings: string[] = parseJsonArray<string>(row.warnings_json);

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
    progress_mode: readable.progressMode ?? 'units',
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

  if (available == null && total == null && legacyCount != null) {
    if (isComplete) {
      available = legacyCount;
      total = legacyCount;
    } else {
      available = legacyCount;
      total = null;
    }
  } else if (available != null && total == null && isComplete) {
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
