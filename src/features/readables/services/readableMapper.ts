// src/features/readables/services/readableMapper.ts
import type { ReadableRow } from '../../../db/schema/readables.schema';
import type { BookReadable, FanficReadable, ReadableItem, BookSource } from '../types';
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

export function mapReadableRowToDomain(row: ReadableRow): ReadableItem {
  const common = {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    status: row.status,
    priority: row.priority,
    moodTags: parseMoodTags(row.mood_tags_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressPercent: row.progress_percent,
  } as const;

  if (row.type === 'book') {
    const book: BookReadable = {
      ...common,
      type: 'book',
      source: (row.source ?? 'manual') as BookSource,
      sourceId: row.source_id,
      pageCount: row.page_count,
      genres: parseJsonArray<string>(row.genres_json),
    };
    return book;
  }

  const fanfic: FanficReadable = {
    ...common,
    type: 'fanfic',
    source: 'ao3',
    ao3WorkId: row.ao3_work_id ?? '',
    ao3Url: row.ao3_url ?? '',
    fandoms: parseJsonArray<string>(row.fandoms_json),
    relationships: parseJsonArray<string>(row.relationships_json),
    characters: parseJsonArray<string>(row.characters_json),
    ao3Tags: parseJsonArray<string>(row.ao3_tags_json),
    rating: (row.rating as FanficReadable['rating']) ?? null,
    warnings: parseJsonArray<string>(row.warnings_json),
    chapterCount: row.chapter_count,
    complete: row.is_complete == null ? null : row.is_complete === 1,
    wordCount: row.word_count,
  };

  return fanfic;
}

interface BuildRowOptions {
  now?: string;
}

/**
 * Build a ReadableRow ready for INSERT/UPDATE from a domain model.
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
    ao3_work_id: null,
    ao3_url: null,
    fandoms_json: null,
    relationships_json: null,
    characters_json: null,
    ao3_tags_json: null,
    rating: null,
    warnings_json: null,
    chapter_count: null,
    is_complete: null,
    word_count: null,
    genres_json: null,
    mood_tags_json: stringifyJsonArray(readable.moodTags),
    created_at: readable.createdAt || now,
    updated_at: now,
    progress_percent: readable.progressPercent,
  };

  if (readable.type === 'book') {
    return {
      ...base,
      type: 'book',
      source: readable.source,
      source_id: readable.sourceId ?? null,
      page_count: readable.pageCount ?? null,
      genres_json: stringifyJsonArray(readable.genres),
    };
  }

  return {
    ...base,
    type: 'fanfic',
    source: 'ao3',
    ao3_work_id: readable.ao3WorkId,
    ao3_url: readable.ao3Url,
    fandoms_json: stringifyJsonArray(readable.fandoms),
    relationships_json: stringifyJsonArray(readable.relationships),
    characters_json: stringifyJsonArray(readable.characters),
    ao3_tags_json: stringifyJsonArray(readable.ao3Tags),
    rating: readable.rating ?? null,
    warnings_json: stringifyJsonArray(readable.warnings),
    chapter_count: readable.chapterCount ?? null,
    is_complete: readable.complete == null ? null : readable.complete ? 1 : 0,
    word_count: readable.wordCount ?? null,
  };
}
