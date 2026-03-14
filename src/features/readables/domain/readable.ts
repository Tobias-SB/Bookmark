// src/features/readables/domain/readable.ts
// §3, §4 — Canonical readable model. Do not reinvent between sessions.
// ReadableStatus, ReadableKind, ProgressUnit, Readable, and ReadableFilters
// are fixed for v1 — do not extend without explicit instruction.
//
// Extensions from base spec (user-confirmed scope expansions):
//   isbn              — ISBN-13 or ISBN-10 from import; null for manual/AO3 entries.
//   coverUrl          — Remote image URL from import; null for manual/AO3 entries.
//   availableChapters — Fanfic only: chapters published at import time (distinct from
//                       progressCurrent = user's reading position and
//                       progressTotal = planned final chapter count).

// ── Kind ─────────────────────────────────────────────────────────────────────

export type ReadableKind = 'book' | 'fanfic';

// ── Progress unit ─────────────────────────────────────────────────────────────
// Derived from kind: books → "pages", fanfic → "chapters".
// Always written by the repository from kind — never accepted from user input.

export type ProgressUnit = 'pages' | 'chapters';

// ── Status ────────────────────────────────────────────────────────────────────
// Fixed four-value union. Do not add values without explicit instruction.
// dnf is a first-class status — not a special case, not hidden.

export type ReadableStatus = 'want_to_read' | 'reading' | 'completed' | 'dnf';

// Ordered array for iteration (e.g. filter chips, segmented buttons).
export const READABLE_STATUSES: readonly ReadableStatus[] = [
  'want_to_read',
  'reading',
  'completed',
  'dnf',
] as const;

// ── Status labels ─────────────────────────────────────────────────────────────
// Two label vocabularies: short (segmented buttons, tight UI) and full (chips, lists).

/** Short labels — used in form segmented buttons and the detail screen status selector. */
export const STATUS_LABELS_SHORT: Record<ReadableStatus, string> = {
  want_to_read: 'Want',
  reading: 'Reading',
  completed: 'Done',
  dnf: 'DNF',
};

/** Full labels — used in filter chips and list item metadata rows. */
export const STATUS_LABELS_FULL: Record<ReadableStatus, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  completed: 'Completed',
  dnf: 'DNF',
};

// ── Kind labels ───────────────────────────────────────────────────────────────

export const KIND_LABELS: Record<ReadableKind, string> = {
  book: 'Book',
  fanfic: 'Fanfic',
};

// ── Source type ───────────────────────────────────────────────────────────────

export type SourceType = 'manual' | 'ao3' | 'book_provider';

// ── Canonical domain model ────────────────────────────────────────────────────
// Single shared model for books and AO3 works.
// Immutable fields: id, kind, progressUnit, sourceType, sourceId, dateCreated.
// dateUpdated is written by the repository on every write.

export interface Readable {
  /** Local immutable identifier. Generated via Crypto.randomUUID(). Primary DB key. */
  id: string;
  /** Set at creation. Immutable. */
  kind: ReadableKind;
  title: string;
  /** null for anonymous or unknown authors. */
  author: string | null;
  status: ReadableStatus;
  /** User's current reading position: page (books) or chapter (fanfic). */
  progressCurrent: number | null;
  /** Total pages or chapters; null if unknown. For fanfics this is the planned final count. */
  progressTotal: number | null;
  /** Derived from kind. Written by repository. Never accepted from user input. */
  progressUnit: ProgressUnit;
  /** Set at creation. Immutable. */
  sourceType: SourceType;
  /** AO3 work URL or equivalent. */
  sourceUrl: string | null;
  /** External provider ID only. Never the primary DB key. Not overwritten by user edits. */
  sourceId: string | null;
  summary: string | null;
  /** Flat string array. See §5. */
  tags: string[];
  /** AO3 only: false = WIP, true = Complete. Always null for books. */
  isComplete: boolean | null;
  /** ISBN-13 preferred, ISBN-10 fallback. Set from import only; null for manual/AO3. */
  isbn: string | null;
  /** Remote cover image URL (HTTPS). Set from import only; null for manual/AO3. */
  coverUrl: string | null;
  /**
   * Fanfic only: chapters published by the author at import time.
   * Distinct from progressCurrent (user's reading position) and progressTotal
   * (planned final chapter count). Set from AO3 import; null for books and manual.
   */
  availableChapters: number | null;
  /** ISO 8601. User-facing. Supports backdating. No future dates. */
  dateAdded: string;
  /** ISO 8601. Set once at creation. Never edited. */
  dateCreated: string;
  /** ISO 8601. Written by the repository on every write. */
  dateUpdated: string;
}

// ── Filters ───────────────────────────────────────────────────────────────────
// Used by listReadables (hook layer), query key factory, and library screen state.
// Filtering and sorting are applied in JS in the hook layer — not in SQLite.
// Default state: { sortBy: 'dateAdded', sortOrder: 'desc' }. All other fields absent.

export interface ReadableFilters {
  /** Filter by kind. Absent = show all kinds. */
  kind?: ReadableKind;
  status?: ReadableStatus;
  /** AO3 WIP/Complete filter. Ignored for books (books always have isComplete = null). */
  isComplete?: boolean;
  /** Case-insensitive partial match against title and author. */
  search?: string;
  sortBy?: 'dateAdded' | 'title' | 'dateUpdated';
  sortOrder?: 'asc' | 'desc';
}

// ── Progress formatting ───────────────────────────────────────────────────────

/**
 * Formats reading progress as "current / total unit".
 * Returns null when both values are null (caller decides what to show for no progress).
 */
export function formatProgressString(
  progressCurrent: number | null,
  progressTotal: number | null,
  progressUnit: string,
): string | null {
  if (progressCurrent === null && progressTotal === null) return null;
  const current = progressCurrent !== null ? String(progressCurrent) : '--';
  const total = progressTotal !== null ? String(progressTotal) : '?';
  return `${current} / ${total} ${progressUnit}`;
}
