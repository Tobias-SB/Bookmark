export type ReadableKind = 'book' | 'fanfic';
export type ReadableStatus = 'want_to_read' | 'reading' | 'completed' | 'dnf';
export type SourceType = 'manual' | 'ao3' | 'google_books';
export type BookProgressUnit = 'pages' | 'percent' | 'minutes';
export type ProgressUnit = BookProgressUnit | 'chapters';
export type BookFormat = 'print' | 'ebook' | 'audio';
export type AO3Rating = 'general' | 'teen' | 'mature' | 'explicit' | 'not_rated';
export type AuthorType = 'known' | 'anonymous' | 'orphaned';

// AO3's own wording, used to match parsed pages; display text goes through t().
export const AO3_RATING_LABELS: Record<AO3Rating, string> = {
  general: 'General Audiences',
  teen: 'Teen And Up Audiences',
  mature: 'Mature',
  explicit: 'Explicit',
  not_rated: 'Not Rated',
};

export const AO3_ARCHIVE_WARNINGS = [
  'No Archive Warnings Apply',
  'Creator Chose Not To Use Archive Warnings',
  'Graphic Depictions Of Violence',
  'Major Character Death',
  'Rape/Non-Con',
  'Underage',
] as const;

export const AO3_CATEGORIES = ['F/F', 'F/M', 'Gen', 'M/M', 'Multi', 'Other'] as const;

export interface ReadableBase {
  id: string;
  title: string;
  authors: string[];
  status: ReadableStatus;
  progressCurrent: number | null;
  totalUnits: number | null; // book: total pages/minutes (100 for percent); fanfic: planned final chapters
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceId: string | null; // AO3 work id or Google Books volume id
  summary: string | null;
  userTags: string[];
  isFavourite: boolean;
  seriesKey: string | null;
  seriesName: string | null;
  seriesPart: number | null;
  seriesTotal: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastReadAt: string | null;
  readCount: number;
  dateAdded: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book extends ReadableBase {
  kind: 'book';
  progressUnit: BookProgressUnit;
  format: BookFormat | null;
  isbn13: string | null;
  publishedDate: string | null;
  isOwned: boolean | null; // null = not set; only false can show a bookshop link
}

export interface Fanfic extends ReadableBase {
  kind: 'fanfic';
  isComplete: boolean;
  isAbandoned: boolean; // user annotation; independent of isComplete
  availableChapters: number | null; // left side of AO3 "X/Y"
  wordCount: number | null; // null = unknown, never 0
  fandoms: string[];
  relationships: string[];
  characters: string[];
  categories: string[];
  ao3Tags: string[];
  rating: AO3Rating | null;
  archiveWarnings: string[]; // strings, not an enum, so AO3 changes never break parsing
  authorType: AuthorType | null;
  publishedAt: string | null;
  ao3UpdatedAt: string | null;
}

export type Readable = Book | Fanfic;

export type CreateBookInput = Omit<Book, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateFanficInput = Omit<Fanfic, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateReadableInput = CreateBookInput | CreateFanficInput;

type CommonPatch = Partial<Pick<ReadableBase,
  | 'title' | 'authors' | 'status' | 'progressCurrent' | 'totalUnits' | 'sourceUrl'
  | 'summary' | 'userTags' | 'isFavourite' | 'seriesKey' | 'seriesName' | 'seriesPart'
  | 'seriesTotal' | 'startedAt' | 'finishedAt' | 'lastReadAt' | 'readCount' | 'dateAdded'>>;

export type BookPatch = { kind: 'book' } & CommonPatch &
  Partial<Pick<Book, 'progressUnit' | 'format' | 'isbn13' | 'publishedDate' | 'isOwned'>>;

export type FanficPatch = { kind: 'fanfic' } & CommonPatch &
  Partial<Pick<Fanfic, 'isComplete' | 'isAbandoned' | 'availableChapters' | 'wordCount'
    | 'fandoms' | 'relationships' | 'characters' | 'categories' | 'ao3Tags' | 'rating'
    | 'archiveWarnings' | 'authorType' | 'publishedAt' | 'ao3UpdatedAt'>>;

export type ReadablePatch = BookPatch | FanficPatch;

export type ReadingState = 'not_started' | 'in_progress' | 'caught_up' | 'new_chapters' | 'finished' | 'dnf';

export interface ContentPreferences {
  hiddenWarnings: string[];
  hiddenRatings: AO3Rating[];
}
