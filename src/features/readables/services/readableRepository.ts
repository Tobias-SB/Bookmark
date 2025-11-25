// src/features/readables/services/readableRepository.ts
import { getAllAsync, getFirstAsync, runAsync } from '@src/db/sqlite';
import type {
  ReadableItem,
  BookReadable,
  FanficReadable,
  ReadableStatus,
  Ao3Rating,
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
 * Map a DB row into a domain ReadableItem.
 */
function mapRowToReadable(row: ReadableRow): ReadableItem {
  const moodTags: MoodTag[] = row.mood_tags_json
    ? (JSON.parse(row.mood_tags_json) as MoodTag[])
    : [];

  const base = {
    id: row.id,
    type: row.type,
    title: row.title,
    author: row.author,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    moodTags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as const;

  if (row.type === 'book') {
    const genres: string[] = row.genres_json ? (JSON.parse(row.genres_json) as string[]) : [];

    const book: BookReadable = {
      ...base,
      type: 'book',
      source: (row.source as BookReadable['source']) ?? 'manual',
      sourceId: row.source_id ?? null,
      pageCount: row.page_count ?? null,
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
    chapterCount: row.chapter_count ?? null,
    complete: row.is_complete == null ? null : row.is_complete === 1,
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

  return {
    id: readable.id,
    type: readable.type,
    title: readable.title,
    author: readable.author,
    description: readable.description ?? null,
    status: readable.status,
    priority: readable.priority,
    source: isBook ? readable.source : 'ao3',
    source_id: isBook ? (readable.sourceId ?? null) : null,
    page_count: isBook ? (readable.pageCount ?? null) : null,
    ao3_work_id: isFanfic ? readable.ao3WorkId : null,
    ao3_url: isFanfic ? readable.ao3Url : null,
    fandoms_json: isFanfic ? JSON.stringify(readable.fandoms) : null,
    relationships_json: isFanfic ? JSON.stringify(readable.relationships) : null,
    characters_json: isFanfic ? JSON.stringify(readable.characters) : null,
    ao3_tags_json: isFanfic ? JSON.stringify(readable.ao3Tags) : null,
    rating: isFanfic ? (readable.rating ?? null) : null,
    warnings_json: isFanfic ? JSON.stringify(readable.warnings) : null,
    chapter_count: isFanfic ? (readable.chapterCount ?? null) : null,
    is_complete: isFanfic ? (readable.complete == null ? null : readable.complete ? 1 : 0) : null,
    word_count: isFanfic ? (readable.wordCount ?? null) : null,
    genres_json: isBook ? JSON.stringify(readable.genres) : null,
    mood_tags_json: JSON.stringify(readable.moodTags ?? []),
    created_at: readable.createdAt,
    updated_at: readable.updatedAt,
  };
}

/**
 * Build a row from a "new" readable that doesn't have id/createdAt/updatedAt yet.
 */
function buildRowFromNewReadable(
  readable: Omit<ReadableItem, 'id' | 'createdAt' | 'updatedAt'>,
): ReadableRow {
  const now = new Date().toISOString();
  const withMeta: ReadableItem = {
    ...(readable as ReadableItem),
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  return buildRowFromReadable(withMeta);
}

/**
 * Repository interface and implementation.
 */

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
 * We treat updated_at as "finished at" because status is changed when you finish.
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

  // 25 columns, 25 values. Must match table definition exactly.
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
      ao3_work_id,
      ao3_url,
      fandoms_json,
      relationships_json,
      characters_json,
      ao3_tags_json,
      rating,
      warnings_json,
      chapter_count,
      is_complete,
      word_count,
      genres_json,
      mood_tags_json,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      row.ao3_work_id,
      row.ao3_url,
      row.fandoms_json,
      row.relationships_json,
      row.characters_json,
      row.ao3_tags_json,
      row.rating,
      row.warnings_json,
      row.chapter_count,
      row.is_complete,
      row.word_count,
      row.genres_json,
      row.mood_tags_json,
      row.created_at,
      row.updated_at,
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
  const updated: ReadableItem = {
    ...readable,
    createdAt: existing.createdAt, // keep original
    updatedAt: now,
  };
  const row = buildRowFromReadable(updated);

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
      ao3_work_id = ?,
      ao3_url = ?,
      fandoms_json = ?,
      relationships_json = ?,
      characters_json = ?,
      ao3_tags_json = ?,
      rating = ?,
      warnings_json = ?,
      chapter_count = ?,
      is_complete = ?,
      word_count = ?,
      genres_json = ?,
      mood_tags_json = ?,
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
      row.ao3_work_id,
      row.ao3_url,
      row.fandoms_json,
      row.relationships_json,
      row.characters_json,
      row.ao3_tags_json,
      row.rating,
      row.warnings_json,
      row.chapter_count,
      row.is_complete,
      row.word_count,
      row.genres_json,
      row.mood_tags_json,
      row.updated_at,
      row.id,
    ],
  );

  return updated;
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
 */
async function updateStatus(id: string, status: ReadableStatus): Promise<void> {
  const now = new Date().toISOString();

  await runAsync(
    `
    UPDATE readables
    SET status = ?, updated_at = ?
    WHERE id = ?;
  `,
    [status, now, id],
  );
}

export const readableRepository = {
  getAllToRead,
  getAll,
  getAllFinished,
  getById,
  insert,
  update,
  delete: remove,
  updateStatus,
};
