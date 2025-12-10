import type { MoodTag } from '../../db/schema/moods.schema';

export type ReadableStatus = 'to-read' | 'reading' | 'finished' | 'DNF';

export type ReadableType = 'book' | 'fanfic';

export const READABLE_STATUS_LABELS: Record<ReadableStatus, string> = {
  'to-read': 'To read',
  reading: 'Reading',
  finished: 'Finished',
  DNF: 'Did not finish',
};

/**
 * Filter options for the Library screen:
 * - 'all' shows everything
 * - others match ReadableStatus values
 */
export type LibraryFilter = 'all' | ReadableStatus;

export interface BaseReadableItem {
  id: string;
  type: ReadableType;
  title: string;
  author: string;
  description?: string | null;
  status: ReadableStatus;
  priority: number; // 1–5
  /**
   * Reading progress in percent (0–100).
   * - to-read: usually 0
   * - reading: 1–99
   * - finished: 100
   * - DNF: how far you got when you stopped
   */
  progressPercent: number;

  // Time-based progress (for audio / Kindle time)
  timeCurrentSeconds?: number | null;
  timeTotalSeconds?: number | null;

  moodTags: MoodTag[];

  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  dnfAt?: string | null;

  notes?: string | null;
}

export type BookSource = 'manual' | 'googleBooks' | 'openLibrary' | 'goodreads';

/**
 * Book readables
 *
 * - pageCount: total pages if known (from metadata or manual entry)
 * - currentPage: where the reader is now (used to compute progressPercent)
 */
export interface BookReadable extends BaseReadableItem {
  type: 'book';
  source: BookSource;
  sourceId?: string | null;
  pageCount?: number | null;
  currentPage?: number | null;
  genres: string[];
}

export type Ao3Rating = 'G' | 'T' | 'M' | 'E' | 'NR';

/**
 * Fanfic readables
 *
 * AO3-style chapter metadata:
 * - availableChapters: chapters currently posted (left side of "X/Y")
 * - totalChapters: total planned chapters or null when AO3 shows '?'
 * - currentChapter: where the reader is now (used to compute progressPercent)
 *
 * For backwards compatibility:
 * - chapterCount: legacy "total chapters" (we now treat as totalChapters)
 */
export interface FanficReadable extends BaseReadableItem {
  type: 'fanfic';
  source: 'ao3';
  ao3WorkId: string;
  ao3Url: string;
  fandoms: string[];
  relationships: string[];
  characters: string[];
  ao3Tags: string[];
  rating?: Ao3Rating | null;
  warnings: string[];

  /** Legacy total-chapter count from earlier versions. Prefer totalChapters. */
  chapterCount?: number | null;

  /** Chapters currently posted (X in X/Y). */
  availableChapters?: number | null;

  /** Total planned chapters (Y in X/Y) or null when AO3 shows '?'. */
  totalChapters?: number | null;

  /** Where the reader is now (chapter index). */
  currentChapter?: number | null;

  complete?: boolean | null;
  wordCount?: number | null;
}

export type ReadableItem = BookReadable | FanficReadable;
