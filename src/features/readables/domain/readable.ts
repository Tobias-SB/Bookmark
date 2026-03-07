// src/features/readables/domain/readable.ts
// §3, §4 — Canonical readable model. Do not reinvent between sessions.
// ReadableStatus, ReadableKind, ProgressUnit, Readable, and ReadableFilters
// are fixed for v1 — do not extend without explicit instruction.

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
  /** Current page (books) or chapter (fanfic). */
  progressCurrent: number | null;
  /** Total pages or chapters; null if unknown. */
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
  status?: ReadableStatus;
  /** AO3 WIP/Complete filter. Ignored for books (books always have isComplete = null). */
  isComplete?: boolean;
  /** Case-insensitive partial match against title and author. */
  search?: string;
  sortBy?: 'dateAdded' | 'title' | 'dateUpdated';
  sortOrder?: 'asc' | 'desc';
}
