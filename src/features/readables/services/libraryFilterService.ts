// src/features/readables/services/libraryFilterService.ts
import type { ReadableItem } from '../types';
import type {
  LibraryFilterState,
  LibrarySortField,
  LibrarySortDirection,
} from '../types/libraryFilters';

/**
 * Apply the full library filter state to a list of readables
 * and return a new filtered + sorted array.
 */
export function filterAndSortReadables(
  items: ReadableItem[],
  filter: LibraryFilterState,
): ReadableItem[] {
  const filtered = items.filter((item) => matchesFilter(item, filter));
  const sorted = [...filtered].sort((a, b) =>
    compareBySort(a, b, filter.sortField, filter.sortDirection),
  );
  return sorted;
}

/**
 * Apply only the filtering part, without sorting.
 */
export function filterReadables(items: ReadableItem[], filter: LibraryFilterState): ReadableItem[] {
  return items.filter((item) => matchesFilter(item, filter));
}

/**
 * Apply only the sort logic, assuming an already-filtered list.
 */
export function sortReadables(
  items: ReadableItem[],
  sortField: LibrarySortField,
  sortDirection: LibrarySortDirection,
): ReadableItem[] {
  return [...items].sort((a, b) => compareBySort(a, b, sortField, sortDirection));
}

// ---------- Internal helpers ----------

function matchesFilter(item: ReadableItem, filter: LibraryFilterState): boolean {
  // -------- Multi-term search (title/author/description/tags/moods/etc.) --------
  const tokens: string[] = [];

  if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
    tokens.push(filter.searchQuery.trim());
  }

  if (Array.isArray(filter.searchTerms) && filter.searchTerms.length > 0) {
    for (const term of filter.searchTerms) {
      const trimmed = term.trim();
      if (trimmed.length > 0) {
        tokens.push(trimmed);
      }
    }
  }

  if (tokens.length > 0) {
    const searchableText = buildItemSearchableText(item);
    const normalizedHaystack = normalizeForSearch(searchableText);

    // AND semantics: item must match all terms.
    for (const token of tokens) {
      const normalizedToken = normalizeForSearch(token);
      if (normalizedToken.length === 0) continue;

      if (!normalizedHaystack.includes(normalizedToken)) {
        return false;
      }
    }
  }

  // -------- Status filter: 'all' or direct match --------
  if (filter.status !== 'all' && item.status !== filter.status) {
    return false;
  }

  // -------- Type filter: 'all' or direct match --------
  if (filter.type !== 'all' && item.type !== filter.type) {
    return false;
  }

  // -------- Rating filter --------
  if (filter.rating !== 'all') {
    const rating = getItemRating(item);
    if (!rating || rating !== filter.rating) {
      return false;
    }
  }

  // -------- Work state filter (complete vs wip) --------
  if (filter.workState !== 'all') {
    const isComplete = isItemComplete(item);
    if (filter.workState === 'complete' && !isComplete) return false;
    if (filter.workState === 'wip' && isComplete) return false;
  }

  // -------- Mood tags filter (ANY match) --------
  if (filter.moodTags.length > 0) {
    if (!item.moodTags || item.moodTags.length === 0) {
      return false;
    }

    const filterSet = new Set(filter.moodTags);
    const itemSet = new Set(item.moodTags);

    let hasOverlap = false;
    for (const mood of filterSet) {
      if (itemSet.has(mood)) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) return false;
  }

  return true;
}

/**
 * Derive whether an item should be considered "complete" vs "wip"
 * for filter purposes.
 */
function isItemComplete(item: ReadableItem): boolean {
  if (item.status === 'finished' || item.status === 'DNF') {
    return true;
  }

  if (item.progressPercent >= 100) {
    return true;
  }

  return false;
}

/**
 * Extracts a rating value from a ReadableItem, if available.
 * This keeps rating-specific knowledge in one place.
 */
function getItemRating(item: ReadableItem) {
  const anyItem = item as any;

  if (typeof anyItem.rating === 'string') {
    return anyItem.rating;
  }

  if (anyItem.ao3Metadata && typeof anyItem.ao3Metadata.rating === 'string') {
    return anyItem.ao3Metadata.rating;
  }

  return null;
}

/**
 * Builds the string that we use for free-text search.
 * This is the canonical place to define "what search should look at".
 *
 * Currently matches your old applyLibraryQuery behavior:
 * - title
 * - author
 * - description
 * - mood tags
 * - fanfic: fandoms, relationships, characters, ao3Tags, warnings
 * - book: genres
 */
function buildItemSearchableText(item: ReadableItem): string {
  const parts: string[] = [];

  if (item.title) parts.push(item.title);
  if (item.author) parts.push(item.author);
  if (item.description) parts.push(item.description);

  // Mood tags: MoodTag is a string union, so we just push the string values.
  if (item.moodTags && item.moodTags.length > 0) {
    for (const mood of item.moodTags) {
      parts.push(mood);
    }
  }

  // Fanfic-specific fields
  if (item.type === 'fanfic') {
    if (Array.isArray(item.fandoms)) parts.push(...item.fandoms);
    if (Array.isArray(item.relationships)) parts.push(...item.relationships);
    if (Array.isArray(item.characters)) parts.push(...item.characters);
    if (Array.isArray(item.ao3Tags)) parts.push(...item.ao3Tags);
    if (Array.isArray(item.warnings)) parts.push(...item.warnings);
  }

  // Book-specific fields
  if (item.type === 'book') {
    if (Array.isArray(item.genres)) parts.push(...item.genres);
  }

  return parts.join(' ');
}

/**
 * Normalizes a string for search so that:
 * - case is ignored
 * - hyphens/underscores are treated like spaces
 * - other punctuation is stripped
 * - multiple spaces are collapsed
 *
 * This makes "fast-paced" and "fast paced" normalize to the same string.
 */
function normalizeForSearch(input: string): string {
  return (
    input
      .toLowerCase()
      // treat hyphens/underscores as spaces
      .replace(/[-_]+/g, ' ')
      // remove any non-alphanumeric characters
      .replace(/[^a-z0-9]+/g, ' ')
      // collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function compareBySort(
  a: ReadableItem,
  b: ReadableItem,
  field: LibrarySortField,
  direction: LibrarySortDirection,
): number {
  const dir = direction === 'asc' ? 1 : -1;

  switch (field) {
    case 'title':
      return dir * compareStrings(a.title, b.title);
    case 'author':
      return dir * compareStrings(a.author, b.author);
    case 'createdAt':
      return dir * compareStrings(a.createdAt, b.createdAt);
    case 'updatedAt':
      return dir * compareStrings(a.updatedAt, b.updatedAt);
    case 'priority':
      return dir * compareNumbers(a.priority, b.priority);
    case 'progressPercent':
      return dir * compareNumbers(a.progressPercent, b.progressPercent);
    default:
      return 0;
  }
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareNumbers(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
