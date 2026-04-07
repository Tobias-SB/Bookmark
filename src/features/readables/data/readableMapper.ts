// src/features/readables/data/readableMapper.ts
// Maps between raw SQLite rows (snake_case) and the domain Readable
// model (camelCase). This file is internal to the data layer — ReadableRow
// is not exported from the feature's index.ts.

import type {
  Readable,
  ReadableKind,
  ReadableStatus,
  ProgressUnit,
  SourceType,
  AO3Rating,
  AuthorType,
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
  total_units: number | null;
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
  word_count: number | null;
  fandom: string; // JSON array
  relationships: string; // JSON array
  rating: string | null;
  archive_warnings: string; // JSON array
  series_name: string | null;
  series_part: number | null;
  series_total: number | null;
  notes: string | null;
  notes_updated_at: string | null;
  published_at: string | null;
  ao3_updated_at: string | null;
  is_abandoned: number; // SQLite INTEGER: 1 = true, 0 = false (NOT NULL DEFAULT 0)
  author_type: string | null;
  date_added: string;
  date_created: string;
  date_updated: string;
}

// ── Tag serialisation ─────────────────────────────────────────────────────────

// Safe tag deserialisation. Never throws — returns [] on any failure.
// Array.isArray guard handles the edge case where the column stores the JSON
// literal "null" (or an object/number), which JSON.parse accepts but is invalid.
export function parseTags(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Safe JSON array deserialisation for any string[] column. Same pattern as parseTags.
export function parseJsonArray(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
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

// ── Enum validation ───────────────────────────────────────────────────────────

// Throws if a string value read from SQLite is not a member of the expected union.
// Prevents silently propagating invalid values (e.g. from manual DB edits or future
// migration bugs) into the domain model where they would cause undefined behaviour.
function assertEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${field} value in database: "${value}"`);
  }
  return value as T;
}

// For nullable enum columns: returns null if the value is absent or unrecognised
// (rather than throwing) since these fields are optional/import-only.
function parseNullableEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

// ── Row → domain ──────────────────────────────────────────────────────────────

export function rowToReadable(row: ReadableRow): Readable {
  return {
    id: row.id,
    kind: assertEnum<ReadableKind>(row.kind, ['book', 'fanfic'] as const, 'kind'),
    title: row.title,
    author: row.author,
    status: assertEnum<ReadableStatus>(
      row.status,
      ['want_to_read', 'reading', 'completed', 'dnf'] as const,
      'status',
    ),
    progressCurrent: row.progress_current,
    totalUnits: row.total_units,
    progressUnit: assertEnum<ProgressUnit>(
      row.progress_unit,
      ['pages', 'chapters'] as const,
      'progressUnit',
    ),
    sourceType: assertEnum<SourceType>(
      row.source_type,
      ['manual', 'ao3', 'book_provider'] as const,
      'sourceType',
    ),
    sourceUrl: row.source_url,
    sourceId: row.source_id,
    summary: row.summary,
    tags: parseTags(row.tags),
    isComplete: booleanFromSQLite(row.is_complete),
    isbn: row.isbn,
    coverUrl: row.cover_url,
    availableChapters: row.available_chapters,
    wordCount: row.word_count,
    fandom: parseJsonArray(row.fandom),
    relationships: parseJsonArray(row.relationships),
    rating: parseNullableEnum<AO3Rating>(
      row.rating,
      ['general', 'teen', 'mature', 'explicit', 'not_rated'] as const,
    ),
    archiveWarnings: parseJsonArray(row.archive_warnings),
    seriesName: row.series_name,
    seriesPart: row.series_part,
    seriesTotal: row.series_total,
    notes: row.notes,
    notesUpdatedAt: row.notes_updated_at,
    publishedAt: row.published_at,
    ao3UpdatedAt: row.ao3_updated_at,
    isAbandoned: row.is_abandoned !== 0,
    authorType: parseNullableEnum<AuthorType>(
      row.author_type,
      ['known', 'anonymous', 'orphaned'] as const,
    ),
    dateAdded: row.date_added,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
  };
}
