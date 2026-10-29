import type { AO3Rating, ReadableKind, ReadableStatus, ReadingState } from './readable';

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
