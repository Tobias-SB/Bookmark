// src/features/readables/domain/readable.ts
// §3, §4 — Canonical readable model. Do not reinvent between sessions.
// ReadableStatus, ReadableKind, ProgressUnit, Readable, and ReadableFilters
// are the authoritative types for the entire app.

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

// ── AO3 Rating ────────────────────────────────────────────────────────────────

export type AO3Rating = 'general' | 'teen' | 'mature' | 'explicit' | 'not_rated';

export const AO3_RATING_LABELS: Record<AO3Rating, string> = {
  general:   'General Audiences',
  teen:      'Teen And Up Audiences',
  mature:    'Mature',
  explicit:  'Explicit',
  not_rated: 'Not Rated',
};

// ── Author type ───────────────────────────────────────────────────────────────
// Fanfic only. Detected from AO3 import; not editable by user.
//   known     — normal named author
//   anonymous — author link goes to /users/Anonymous
//   orphaned  — work has been orphaned (link goes to /users/orphan_account)

export type AuthorType = 'known' | 'anonymous' | 'orphaned';

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
  /** null for anonymous or orphaned works; 'Anonymous' / 'Orphaned work' rendered by UI. */
  author: string | null;
  status: ReadableStatus;
  /** User's current reading position: page (books) or chapter (fanfic). */
  progressCurrent: number | null;
  /**
   * Total units for completion: pages (books) or planned final chapter count (fanfic).
   * null if unknown.
   */
  totalUnits: number | null;
  /** Derived from kind. Written by repository. Never accepted from user input. */
  progressUnit: ProgressUnit;
  /** Set at creation. Immutable. */
  sourceType: SourceType;
  /** AO3 work URL or equivalent. */
  sourceUrl: string | null;
  /** External provider ID only. Never the primary DB key. Not overwritten by user edits. */
  sourceId: string | null;
  summary: string | null;
  /** Flat string array. */
  tags: string[];
  /** AO3 only: false = WIP, true = Complete. Always null for books. */
  isComplete: boolean | null;
  /** ISBN-13 preferred, ISBN-10 fallback. Set from import only; null for manual/AO3. */
  isbn: string | null;
  /** Remote cover image URL (HTTPS). Set from import only; null for manual/AO3. */
  coverUrl: string | null;

  // ── Fanfic-only fields ───────────────────────────────────────────────────
  // Repository enforces null/[] for books regardless of input.

  /**
   * Fanfic only: chapters published by the author (X in "X/Y").
   * Distinct from progressCurrent (user position) and totalUnits (planned final count).
   */
  availableChapters: number | null;
  /** Fanfic only: total word count. null for books. */
  wordCount: number | null;
  /** Fanfic only: fandom names. [] for books. */
  fandom: string[];
  /** Fanfic only: relationship/ship tags. [] for books. */
  relationships: string[];
  /** Fanfic only: AO3 content rating. null for books. */
  rating: AO3Rating | null;
  /** Fanfic only: canonical AO3 archive warnings. [] for books. */
  archiveWarnings: string[];
  /**
   * Fanfic only: true when the work has been abandoned by its author.
   * Default false. Inferred from AO3 "Abandoned" freeform tag on import.
   */
  isAbandoned: boolean;
  /**
   * Fanfic only. Import-only — never in UpdateReadableInput.
   * 'known' = normal author; 'anonymous' = /users/Anonymous; 'orphaned' = /users/orphan_account.
   */
  authorType: AuthorType | null;
  /** Fanfic only. ISO 8601 date. Import-only — never in UpdateReadableInput. */
  publishedAt: string | null;
  /** Fanfic only. ISO 8601 date. Set by import and refresh; never in UpdateReadableInput. */
  ao3UpdatedAt: string | null;

  // ── Universal v2 fields ──────────────────────────────────────────────────

  /** Series name. Applies to both books and fanfic. */
  seriesName: string | null;
  /** Position within the series. null if not in a series or unknown. */
  seriesPart: number | null;
  /** Total works in the series. null if not in a series or unknown. */
  seriesTotal: number | null;
  /** Private notes. Not imported from AO3. */
  notes: string | null;
  /** ISO 8601. Set automatically by repository when notes changes. Never in UpdateReadableInput. */
  notesUpdatedAt: string | null;

  // ── Timestamps ───────────────────────────────────────────────────────────

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
  /** OR logic — show readables whose status is in this array. Absent/empty = show all. */
  status?: ReadableStatus[];
  /** AO3 WIP/Complete filter. Ignored for books (books always have isComplete = null). */
  isComplete?: boolean;
  /** Fanfic only. true = show only abandoned; false = hide abandoned. Absent = show all. */
  isAbandoned?: boolean;
  /** Fanfic only. Case-insensitive exact match against any entry in fandom[]. */
  fandom?: string;
  /** Fanfic only. OR logic across selected ratings. Absent/empty = show all. */
  rating?: AO3Rating[];
  /** Show only readables with a non-null seriesName. */
  seriesOnly?: boolean;
  /** Show only readables that have ALL of these tags. */
  includeTags?: string[];
  /** Show only readables that have NONE of these tags. */
  excludeTags?: string[];
  /** Case-insensitive partial match against title and author. */
  search?: string;
  sortBy?: 'dateAdded' | 'title' | 'dateUpdated' | 'wordCount' | 'totalUnits';
  sortOrder?: 'asc' | 'desc';
}

// ── Progress formatting ───────────────────────────────────────────────────────

/**
 * Formats reading progress as "current / total unit".
 * For fanfic, pass totalUnits (planned final chapter count) as the second argument.
 * Returns null when both values are null (caller decides what to show for no progress).
 */
export function formatProgressString(
  progressCurrent: number | null,
  totalUnits: number | null,
  progressUnit: string,
): string | null {
  if (progressCurrent === null && totalUnits === null) return null;
  const current = progressCurrent !== null ? String(progressCurrent) : '--';
  const total = totalUnits !== null ? String(totalUnits) : '?';
  return `${current} / ${total} ${progressUnit}`;
}
