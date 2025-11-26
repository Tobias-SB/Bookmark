// src/db/schema/readables.schema.ts
export type ReadableStatus = 'to-read' | 'reading' | 'finished' | 'DNF';
export type ReadableType = 'book' | 'fanfic';

export interface ReadableRow {
  id: string;
  type: ReadableType;
  title: string;
  author: string;
  description: string | null;
  status: ReadableStatus;
  priority: number;
  source: string | null;
  source_id: string | null;
  page_count: number | null;

  // Fanfic-specific fields (nullable for books)
  ao3_work_id: string | null;
  ao3_url: string | null;
  fandoms_json: string | null;
  relationships_json: string | null;
  characters_json: string | null;
  ao3_tags_json: string | null;
  rating: string | null;
  warnings_json: string | null;
  chapter_count: number | null;
  is_complete: number | null; // 0/1
  word_count: number | null;

  genres_json: string | null;
  mood_tags_json: string | null;

  created_at: string;
  updated_at: string;
}

export interface ReadableMoodTagRow {
  id: string;
  readable_id: string;
  mood_tag: string;
}
