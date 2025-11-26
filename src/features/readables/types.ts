// src/features/readables/types.ts
import type { MoodTag } from '../../db/schema/moods.schema';

export type ReadableStatus = 'to-read' | 'reading' | 'finished' | 'DNF';

export type ReadableType = 'book' | 'fanfic';

export const READABLE_STATUS_LABELS: Record<ReadableStatus, string> = {
  'to-read': 'To read',
  reading: 'Reading',
  finished: 'Finished',
  DNF: 'Did not finish',
};

export interface BaseReadableItem {
  id: string;
  type: ReadableType;
  title: string;
  author: string;
  description?: string | null;
  status: ReadableStatus;
  priority: number; // 1–5
  moodTags: MoodTag[];
  createdAt: string;
  updatedAt: string;
}

export type BookSource = 'manual' | 'googleBooks' | 'openLibrary' | 'goodreads';

export interface BookReadable extends BaseReadableItem {
  type: 'book';
  source: BookSource;
  sourceId?: string | null;
  pageCount?: number | null;
  genres: string[];
}

export type Ao3Rating = 'G' | 'T' | 'M' | 'E' | 'NR';

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
  chapterCount?: number | null;
  complete?: boolean | null;
  wordCount?: number | null;
}

export type ReadableItem = BookReadable | FanficReadable;
