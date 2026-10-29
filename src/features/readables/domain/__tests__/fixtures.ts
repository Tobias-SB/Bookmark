import type { Book, Fanfic } from '../readable';

const base = {
  authors: ['Author'],
  status: 'want_to_read' as const,
  progressCurrent: null,
  totalUnits: null,
  sourceType: 'manual' as const,
  sourceUrl: null,
  sourceId: null,
  summary: null,
  userTags: [],
  isFavourite: false,
  seriesKey: null,
  seriesName: null,
  seriesPart: null,
  seriesTotal: null,
  startedAt: null,
  finishedAt: null,
  lastReadAt: null,
  readCount: 0,
  dateAdded: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function makeBook(over: Partial<Book> = {}): Book {
  return {
    ...base,
    id: 'b1',
    title: 'Book',
    kind: 'book',
    progressUnit: 'pages',
    format: null,
    isbn13: null,
    publishedDate: null,
    isOwned: null,
    ...over,
  };
}

export function makeFanfic(over: Partial<Fanfic> = {}): Fanfic {
  return {
    ...base,
    id: 'f1',
    title: 'Fic',
    kind: 'fanfic',
    isComplete: false,
    isAbandoned: false,
    availableChapters: null,
    wordCount: null,
    fandoms: [],
    relationships: [],
    characters: [],
    categories: [],
    ao3Tags: [],
    rating: null,
    archiveWarnings: [],
    authorType: null,
    publishedAt: null,
    ao3UpdatedAt: null,
    ...over,
  };
}
