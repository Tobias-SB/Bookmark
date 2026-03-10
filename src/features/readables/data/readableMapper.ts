// src/features/readables/data/readableMapper.ts
// §12 — Maps between raw SQLite rows (snake_case) and the domain Readable
// model (camelCase). This file is internal to the data layer — ReadableRow
// is not exported from the feature's index.ts.

import type {
  Readable,
  ReadableKind,
  ReadableStatus,
  ProgressUnit,
  SourceType,
} from '../domain/readable';

// ── Raw row shape ─────────────────────────────────────────────────────────────
// Mirrors the SQLite column names exactly. Never used outside src/features/readables/data/.

export interface ReadableRow {
  id: string;
  kind: string;
  title: string;
  author: string | null;
  status: string;
  progress_current: number | null;
  progress_total: number | null;
  progress_unit: string;
  source_type: string;
  source_url: string | null;
  source_id: string | null;
  summary: string | null;
  tags: string;
  is_complete: number | null; // SQLite INTEGER: 1 = true, 0 = false, null = null
  isbn: string | null;
  cover_url: string | null;
  available_chapters: number | null;
  date_added: string;
  date_created: string;
  date_updated: string;
}

// ── Tag serialisation ─────────────────────────────────────────────────────────

// §5 — Safe tag deserialisation. Never throws — returns [] on any failure.
export function parseTags(raw: string | null): string[] {
  try {
    return JSON.parse(raw ?? '[]') ?? [];
  } catch {
    return [];
  }
}

// ── Boolean ↔ SQLite INTEGER ──────────────────────────────────────────────────

// SQLite has no native boolean. We store: true → 1, false → 0, null → null.
export function booleanFromSQLite(value: number | null): boolean | null {
  if (value === null) return null;
  return value !== 0;
}

export function booleanToSQLite(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}

// ── Row → domain ──────────────────────────────────────────────────────────────

export function rowToReadable(row: ReadableRow): Readable {
  return {
    id: row.id,
    kind: row.kind as ReadableKind,
    title: row.title,
    author: row.author,
    status: row.status as ReadableStatus,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total,
    progressUnit: row.progress_unit as ProgressUnit,
    sourceType: row.source_type as SourceType,
    sourceUrl: row.source_url,
    sourceId: row.source_id,
    summary: row.summary,
    tags: parseTags(row.tags),
    isComplete: booleanFromSQLite(row.is_complete),
    isbn: row.isbn,
    coverUrl: row.cover_url,
    availableChapters: row.available_chapters,
    dateAdded: row.date_added,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}
