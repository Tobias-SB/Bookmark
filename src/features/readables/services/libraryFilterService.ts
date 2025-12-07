// src/features/readables/services/libraryFilterService.ts
import type { ReadableItem, Ao3Rating } from '../types';
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
  // -------- Free-text search (title/author/description/tags/moods/etc.) --------
  const rawQuery = filter.searchQuery.trim();
  if (rawQuery.length > 0) {
    const normalizedQuery = normalizeForSearch(rawQuery);

    if (normalizedQuery.length > 0) {
      const searchableText = buildItemSearchableText(item);
      const normalizedHaystack = normalizeForSearch(searchableText);

      // This makes "fast paced" match "fast-paced", "FAST-PACED", etc.
      if (!normalizedHaystack.includes(normalizedQuery)) {
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

  // Optional extra heuristic: if progressPercent is 100, treat as complete.
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
 * Currently matches previous applyLibraryQuery behavior:
 * - title
 * - author
 * - description
 * - mood tags
 * - fanfic: fandoms, relationships, characters, ao3Tags, warnings
 * - book: genres
 *
 * Extended:
 * - fanfic: human-readable rating label (e.g. "Explicit")
 * - fanfic: completion label ("Complete" / "Work in Progress")
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
    const fanfic: any = item;

    // Rating label: "General Audiences", "Teen and Up", "Mature", "Explicit", "Not Rated"
    const rating = fanfic.rating as Ao3Rating | undefined;
    if (rating) {
      parts.push(mapAo3RatingToLabel(rating));
    }

    // Completion label: mirror FanficMetadataSection logic:
    // complete === true → "Complete"
    // anything else      → "Work in Progress"
    const complete = fanfic.complete as boolean | undefined;
    if (complete === true) {
      parts.push('Complete');
    } else {
      parts.push('Work in Progress');
    }

    if (Array.isArray(fanfic.fandoms)) parts.push(...fanfic.fandoms);
    if (Array.isArray(fanfic.relationships)) parts.push(...fanfic.relationships);
    if (Array.isArray(fanfic.characters)) parts.push(...fanfic.characters);
    if (Array.isArray(fanfic.ao3Tags)) parts.push(...fanfic.ao3Tags);
    if (Array.isArray(fanfic.warnings)) parts.push(...fanfic.warnings);
  }

  // Book-specific fields
  if (item.type === 'book') {
    const book: any = item;
    if (Array.isArray(book.genres)) parts.push(...book.genres);
  }

  return parts.join(' ');
}

/**
 * Map AO3 rating codes to the human-readable labels we show in the UI.
 * Kept in sync with FanficMetadataSection.
 */
function mapAo3RatingToLabel(rating: Ao3Rating): string {
  switch (rating) {
    case 'G':
      return 'General Audiences';
    case 'T':
      return 'Teen and Up';
    case 'M':
      return 'Mature';
    case 'E':
      return 'Explicit';
    case 'NR':
      return 'Not Rated';
    default:
      return rating;
  }
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
