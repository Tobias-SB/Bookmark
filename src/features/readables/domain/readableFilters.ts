import {
  chaptersBehind,
  readingStateOf,
  type AO3Rating,
  type ContentPreferences,
  type Readable,
  type ReadableKind,
  type ReadableStatus,
  type ReadingState,
} from './readable';

export interface ReadableFilters {
  version: 1;
  kind?: ReadableKind;
  status?: ReadableStatus[]; // OR
  readingState?: ReadingState[]; // OR
  favouritesOnly?: boolean;
  shelfId?: string;
  seriesOnly?: boolean;
  ownership?: 'owned' | 'not_owned'; // books only; 'not_owned' means isOwned === false
  isComplete?: boolean; // fanfic only
  isAbandoned?: boolean; // fanfic only; true = only, false = hide
  fandoms?: string[]; // fanfic only; OR, case-insensitive exact
  relationships?: string[]; // fanfic only; OR
  characters?: string[]; // fanfic only; OR
  ratings?: AO3Rating[]; // fanfic only; OR
  categories?: string[]; // fanfic only; OR
  excludeWarnings?: string[]; // fanfic only; hide works carrying ANY of these
  includeTags?: string[]; // AND over userTags ∪ ao3Tags
  excludeTags?: string[]; // NONE over userTags ∪ ao3Tags
  lengthMin?: number; // words (fanfic) or pages (books)
  lengthMax?: number;
  search?: string;
  sortBy?: 'dateAdded' | 'title' | 'author' | 'updatedAt' | 'lastReadAt'
    | 'length' | 'chaptersBehind' | 'ao3UpdatedAt';
  sortOrder?: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: ReadableFilters = { version: 1, sortBy: 'dateAdded', sortOrder: 'desc' };

// ---- Behaviour (spec §7.2, §7.8) ----

export type MatchField = 'title' | 'authors' | 'tags' | 'summary' | 'notes' | 'other';

export interface FilterResult {
  items: Readable[];
  matchedIn: Record<string, MatchField>;
  hiddenByPrefsCount: number;
}

export type NotesByReadable = Record<string, readonly { body: string }[]>;

type SortKey = NonNullable<ReadableFilters['sortBy']>;
type Fanfic = Extract<Readable, { kind: 'fanfic' }>;

const MATCH_ORDER: readonly MatchField[] = ['title', 'authors', 'tags', 'summary', 'notes', 'other'];

export function normalizeText(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const norm = normalizeText;
const allTags = (r: Readable): string[] => (r.kind === 'fanfic' ? [...r.userTags, ...r.ao3Tags] : r.userTags);

// ---- Content preferences ----

function isHiddenByPrefs(r: Readable, prefs: ContentPreferences): boolean {
  if (r.kind !== 'fanfic') return false;
  if (r.rating !== null && prefs.hiddenRatings.includes(r.rating)) return true;
  const hidden = prefs.hiddenWarnings.map(norm);
  return r.archiveWarnings.some((w) => hidden.includes(norm(w)));
}

// ---- Axis matching ----

function anyOf(values: readonly string[], wanted: readonly string[]): boolean {
  const set = new Set(wanted.map(norm));
  return values.some((v) => set.has(norm(v)));
}

function lengthOf(r: Readable): number | null {
  if (r.kind === 'fanfic') return r.wordCount;
  return r.progressUnit === 'pages' ? r.totalUnits : null;
}

function matchesLength(r: Readable, f: ReadableFilters): boolean {
  if (f.lengthMin === undefined && f.lengthMax === undefined) return true;
  const len = lengthOf(r);
  if (len === null) return false;
  return (f.lengthMin === undefined || len >= f.lengthMin) && (f.lengthMax === undefined || len <= f.lengthMax);
}

function matchesTags(r: Readable, f: ReadableFilters): boolean {
  const tags = new Set(allTags(r).map(norm));
  if (f.includeTags?.some((t) => !tags.has(norm(t)))) return false;
  return !f.excludeTags?.some((t) => tags.has(norm(t)));
}

const has = (xs: readonly unknown[] | undefined): boolean => xs !== undefined && xs.length > 0;

function usesFanficAxes(f: ReadableFilters): boolean {
  return (
    f.isComplete !== undefined || f.isAbandoned !== undefined || has(f.ratings) || has(f.excludeWarnings) ||
    has(f.fandoms) || has(f.relationships) || has(f.characters) || has(f.categories)
  );
}

function matchesFanficLists(r: Fanfic, f: ReadableFilters): boolean {
  return (
    (!f.fandoms?.length || anyOf(r.fandoms, f.fandoms)) &&
    (!f.relationships?.length || anyOf(r.relationships, f.relationships)) &&
    (!f.characters?.length || anyOf(r.characters, f.characters)) &&
    (!f.categories?.length || anyOf(r.categories, f.categories)) &&
    (!f.excludeWarnings?.length || !anyOf(r.archiveWarnings, f.excludeWarnings))
  );
}

function matchesFanficAxes(r: Readable, f: ReadableFilters): boolean {
  if (r.kind !== 'fanfic') return !usesFanficAxes(f);
  return (
    (f.isComplete === undefined || r.isComplete === f.isComplete) &&
    (f.isAbandoned === undefined || r.isAbandoned === f.isAbandoned) &&
    (!f.ratings?.length || (r.rating !== null && f.ratings.includes(r.rating))) &&
    matchesFanficLists(r, f)
  );
}

function matchesOwnership(r: Readable, f: ReadableFilters): boolean {
  if (f.ownership === undefined) return true;
  if (r.kind !== 'book') return false;
  return f.ownership === 'owned' ? r.isOwned === true : r.isOwned === false;
}

// shelfId is not applied here: shelf membership is not an input, so callers pass the shelf's readables.
function matchesAxes(r: Readable, f: ReadableFilters): boolean {
  return (
    (f.kind === undefined || r.kind === f.kind) &&
    (!f.status?.length || f.status.includes(r.status)) &&
    (!f.readingState?.length || f.readingState.includes(readingStateOf(r))) &&
    (!f.favouritesOnly || r.isFavourite) &&
    (!f.seriesOnly || r.seriesKey !== null) &&
    matchesOwnership(r, f) &&
    matchesFanficAxes(r, f) &&
    matchesTags(r, f) &&
    matchesLength(r, f)
  );
}

// ---- Search ----

export function parseSearch(query: string): string[] {
  const terms: string[] = [];
  for (const m of query.matchAll(/"([^"]*)"|(\S+)/g)) {
    const term = norm((m[1] ?? m[2] ?? '').replace(/"/g, ''));
    if (term !== '') terms.push(term);
  }
  return terms;
}

function searchFields(r: Readable, notes: readonly { body: string }[]): Record<MatchField, string> {
  const join = (xs: readonly string[]) => xs.map(norm).join('\n');
  const other = r.kind === 'fanfic' ? [...r.fandoms, ...r.relationships, ...r.characters] : [];
  return {
    title: norm(r.title),
    authors: join(r.authors),
    tags: join(allTags(r)),
    summary: norm(r.summary ?? ''),
    notes: join(notes.map((n) => n.body)),
    other: join(other),
  };
}

// Every term must match some field; the reported field is the least prominent one that was needed.
function searchMatch(fields: Record<MatchField, string>, terms: readonly string[]): MatchField | null {
  let worst = 0;
  for (const term of terms) {
    const idx = MATCH_ORDER.findIndex((f) => fields[f].includes(term));
    if (idx < 0) return null;
    worst = Math.max(worst, idx);
  }
  return MATCH_ORDER[worst] ?? null;
}

// ---- Sort ----

function sortValue(r: Readable, key: SortKey): string | number | null {
  switch (key) {
    case 'dateAdded': return r.dateAdded;
    case 'updatedAt': return r.updatedAt;
    case 'lastReadAt': return r.lastReadAt;
    case 'title': return norm(r.title);
    case 'author': return r.authors[0] === undefined ? null : norm(r.authors[0]);
    case 'length': return lengthOf(r);
    case 'chaptersBehind': return r.kind === 'fanfic' ? chaptersBehind(r) : null;
    case 'ao3UpdatedAt': return r.kind === 'fanfic' ? r.ao3UpdatedAt : null;
  }
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function effectiveSort(f: ReadableFilters): { by: SortKey; order: 'asc' | 'desc' } {
  const by = f.sortBy ?? 'dateAdded';
  const order = f.sortOrder ?? (by === 'title' || by === 'author' ? 'asc' : 'desc');
  return { by, order };
}

function sortReadables(items: Readable[], f: ReadableFilters): Readable[] {
  const { by, order } = effectiveSort(f);
  const dir = order === 'asc' ? 1 : -1;
  const keyed = items.map((r) => ({ r, v: sortValue(r, by) }));
  keyed.sort((x, y) => {
    if (x.v === null || y.v === null) return x.v === y.v ? 0 : x.v === null ? 1 : -1; // nulls last both ways
    return dir * compareValues(x.v, y.v);
  });
  return keyed.map((k) => k.r);
}

// ---- Public API ----

export function applyFilters(
  readables: readonly Readable[],
  notesByReadable: NotesByReadable,
  filters: ReadableFilters,
  prefs: ContentPreferences,
): FilterResult {
  const terms = parseSearch(filters.search ?? '');
  const matchedIn: Record<string, MatchField> = {};
  const kept: Readable[] = [];
  let hiddenByPrefsCount = 0;
  for (const r of readables) {
    if (!matchesAxes(r, filters)) continue;
    const field = terms.length === 0 ? null : searchMatch(searchFields(r, notesByReadable[r.id] ?? []), terms);
    if (terms.length > 0 && field === null) continue;
    if (isHiddenByPrefs(r, prefs)) {
      hiddenByPrefsCount += 1;
      continue;
    }
    if (field !== null) matchedIn[r.id] = field;
    kept.push(r);
  }
  return { items: sortReadables(kept, filters), matchedIn, hiddenByPrefsCount };
}

// Badge rule (§7.2): one per non-empty axis, one per tag, one for a non-default sort.
export function countActiveFilters(f: ReadableFilters): number {
  const flags = [
    f.kind !== undefined, f.favouritesOnly === true, f.shelfId !== undefined, f.seriesOnly === true,
    f.ownership !== undefined, f.isComplete !== undefined, f.isAbandoned !== undefined,
    f.lengthMin !== undefined || f.lengthMax !== undefined,
    (f.search ?? '').trim() !== '',
  ].filter(Boolean).length;
  const lists = [f.status, f.readingState, f.fandoms, f.relationships, f.characters, f.ratings, f.categories, f.excludeWarnings]
    .filter(has).length;
  const tags = (f.includeTags?.length ?? 0) + (f.excludeTags?.length ?? 0);
  const { by, order } = effectiveSort(f);
  const defaults = effectiveSort(DEFAULT_FILTERS);
  return flags + lists + tags + (by !== defaults.by || order !== defaults.order ? 1 : 0);
}

export type VocabularyField = 'tags' | 'fandoms' | 'relationships' | 'characters';

function vocabularyValues(r: Readable, field: VocabularyField): string[] {
  if (field === 'tags') return allTags(r);
  return r.kind === 'fanfic' ? r[field] : [];
}

// Unique values (case/diacritic-insensitive, first spelling kept), sorted alphabetically.
export function buildVocabulary(readables: readonly Readable[], field: VocabularyField, kind?: ReadableKind): string[] {
  const seen = new Map<string, string>();
  for (const r of readables) {
    if (kind !== undefined && r.kind !== kind) continue;
    for (const v of vocabularyValues(r, field)) if (!seen.has(norm(v))) seen.set(norm(v), v.trim());
  }
  return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
}
