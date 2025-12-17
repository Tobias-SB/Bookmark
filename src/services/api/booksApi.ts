// src/services/api/booksApi.ts

import { fakeHttpGet, httpGetJson, HttpClientError } from './httpClient';

/**
 * External book search result (used by the lightweight search UI).
 * This is intentionally small and UI-friendly.
 */
export interface ExternalBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  pageCount?: number;
}

/**
 * Canonical book metadata contract used to prefill a Readable (book).
 *
 * Semantics:
 * - Return `BookMetadata` when a match is found.
 * - Return `null` when the request succeeds but nothing matches.
 * - Throw `BooksApiError` for network/server/unknown failures.
 */
export interface BookMetadata {
  title: string | null;
  author: string | null;
  pageCount: number | null;
  genres: string[];
  description: string | null;

  /**
   * Cover URL (Open Library Covers API). Included even if not yet used in UI.
   */
  coverUrl: string | null;
}

export type BooksApiErrorKind = 'NOT_IMPLEMENTED' | 'NETWORK' | 'SERVER' | 'UNKNOWN';

export class BooksApiError extends Error {
  public readonly kind: BooksApiErrorKind;
  public readonly statusCode?: number;

  constructor(args: {
    kind: BooksApiErrorKind;
    message: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'BooksApiError';
    this.kind = args.kind;
    this.statusCode = args.statusCode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).cause = args.cause;
  }
}

export class BooksApiNotImplementedError extends BooksApiError {
  constructor() {
    super({
      kind: 'NOT_IMPLEMENTED',
      message: 'Book metadata lookup is not implemented yet (booksApi is a stub).',
    });
    this.name = 'BooksApiNotImplementedError';
  }
}

export type FetchBookMetadataParams = {
  query: string;
  signal?: AbortSignal;

  /**
   * Controls how aggressively we accept results from Open Library.
   * - strict: require author match (when provided in query) and higher score
   * - flexible: allow title-only matches more often
   */
  mode: 'strict' | 'flexible';
};

/**
 * Lightweight search endpoint used by `useBookSearch`.
 * (Kept mocked for now.)
 */
export async function searchBooks(query: string): Promise<ExternalBook[]> {
  if (!query.trim()) {
    return [];
  }

  const mock: ExternalBook[] = [
    {
      id: 'ext-1',
      title: `Mock Book for "${query}"`,
      author: 'Mock Author',
      description: 'This is a mocked book result.',
      pageCount: 320,
    },
  ];

  const response = await fakeHttpGet(mock);
  return response.data;
}

/**
 * Open Library Search API response shape (partial).
 * Docs: https://openlibrary.org/dev/docs/api/search
 */
type OpenLibrarySearchDoc = {
  key?: string; // e.g. "/works/OL12345W"
  title?: string;
  author_name?: string[];
  first_sentence?: string | string[];
  number_of_pages_median?: number;
  subject?: string[];
  cover_i?: number;
  isbn?: string[];
};

type OpenLibrarySearchResponse = {
  numFound?: number;
  docs?: OpenLibrarySearchDoc[];
};

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, '') // apostrophes
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap / Math.max(ta.size, tb.size);
}

function scoreTitle(inputTitle: string, candidateTitle: string) {
  const a = normalizeText(inputTitle);
  const b = normalizeText(candidateTitle);
  if (!a || !b) return 0;

  if (a === b) return 10;
  if (b.includes(a) || a.includes(b)) return 7;

  const overlap = tokenOverlapScore(a, b);
  if (overlap >= 0.8) return 6;
  if (overlap >= 0.6) return 5;
  if (overlap >= 0.4) return 3;
  if (overlap >= 0.25) return 2;
  return 0;
}

function scoreAuthor(inputAuthor: string, candidateAuthor: string) {
  const a = normalizeText(inputAuthor);
  const b = normalizeText(candidateAuthor);
  if (!a || !b) return 0;

  if (a === b) return 6;
  if (b.includes(a) || a.includes(b)) return 4;

  const overlap = tokenOverlapScore(a, b);
  if (overlap >= 0.7) return 4;
  if (overlap >= 0.5) return 3;
  if (overlap >= 0.35) return 2;
  return 0;
}

function extractLikelyTitleAuthor(query: string): { title: string; author: string | null } {
  // Service currently passes "title author" as a single query string.
  // We can't perfectly split; we use a simple heuristic:
  // - If there's " by " we split on it.
  // - Else we treat the whole thing as title and author unknown.
  const raw = query.trim();
  const lower = raw.toLowerCase();
  const byIdx = lower.indexOf(' by ');
  if (byIdx !== -1) {
    const t = raw.slice(0, byIdx).trim();
    const a = raw.slice(byIdx + 4).trim();
    return { title: t, author: a || null };
  }
  return { title: raw, author: null };
}

function buildCoverUrl(doc: OpenLibrarySearchDoc): string | null {
  // Prefer cover_i (Cover ID) — most reliable and not the rate-limited “ISBN mode” path.
  // Covers API: https://openlibrary.org/dev/docs/api/covers
  if (typeof doc.cover_i === 'number') {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  }

  const isbn = doc.isbn?.find(Boolean) ?? null;
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`;
  }

  return null;
}

function docToMetadata(doc: OpenLibrarySearchDoc): BookMetadata {
  const title = doc.title?.trim() || null;
  const author = doc.author_name?.[0]?.trim() || null;

  let description: string | null = null;
  if (typeof doc.first_sentence === 'string') {
    description = doc.first_sentence.trim() || null;
  } else if (Array.isArray(doc.first_sentence) && typeof doc.first_sentence[0] === 'string') {
    description = doc.first_sentence[0].trim() || null;
  }

  const pageCount =
    typeof doc.number_of_pages_median === 'number' && Number.isFinite(doc.number_of_pages_median)
      ? doc.number_of_pages_median
      : null;

  const genres = Array.isArray(doc.subject)
    ? doc.subject
        .filter((s) => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    title,
    author,
    description,
    pageCount,
    genres,
    coverUrl: buildCoverUrl(doc),
  };
}

function mapHttpClientErrorToBooksApiError(err: HttpClientError, url: string): BooksApiError {
  if (err.kind === 'HTTP') {
    const status = err.statusCode ?? 0;
    const isServer = status >= 500 || status === 429 || status === 403;
    return new BooksApiError({
      kind: isServer ? 'SERVER' : 'UNKNOWN',
      statusCode: status,
      message: `Books API HTTP error (${status}) while requesting Open Library`,
      cause: err,
    });
  }

  if (err.kind === 'TIMEOUT' || err.kind === 'NETWORK') {
    return new BooksApiError({
      kind: 'NETWORK',
      message: `Books API network error while requesting Open Library`,
      cause: err,
    });
  }

  return new BooksApiError({
    kind: 'UNKNOWN',
    message: `Books API unexpected error while requesting Open Library`,
    cause: err,
  });
}

/**
 * Book metadata lookup for pre-filling a Readable (book) using Open Library.
 *
 * - Uses /search.json
 * - Picks a “best” result by a small scoring heuristic
 * - Returns null if no acceptable match is found
 */
export async function fetchBookMetadata(
  params: FetchBookMetadataParams,
): Promise<BookMetadata | null> {
  const query = params.query.trim();
  if (!query) return null;

  // Use fields= to avoid relying on Open Library's default field set.
  // Docs: https://openlibrary.org/dev/docs/api/search
  const fields = [
    'key',
    'title',
    'author_name',
    'first_sentence',
    'number_of_pages_median',
    'subject',
    'cover_i',
    'isbn',
  ].join(',');

  const url =
    `https://openlibrary.org/search.json?` +
    `q=${encodeURIComponent(query)}` +
    `&limit=10` +
    `&fields=${encodeURIComponent(fields)}`;

  let json: OpenLibrarySearchResponse;
  try {
    json = await httpGetJson<OpenLibrarySearchResponse>(url, {
      signal: params.signal,
      timeoutMs: 12_000,
    });
  } catch (cause: unknown) {
    if (cause instanceof HttpClientError) {
      throw mapHttpClientErrorToBooksApiError(cause, url);
    }

    throw new BooksApiError({
      kind: 'UNKNOWN',
      message: 'Books API unexpected error while requesting Open Library',
      cause,
    });
  }

  const docs = Array.isArray(json.docs) ? json.docs : [];
  if (docs.length === 0) return null;

  // We try to score based on inferred title/author from query, but query is not perfectly structured.
  // If you later add explicit title/author params, scoring becomes even better.
  const inferred = extractLikelyTitleAuthor(query);
  const inputTitle = inferred.title;
  const inputAuthor = inferred.author;

  const candidates = docs
    .map((doc) => {
      const meta = docToMetadata(doc);
      const tScore = meta.title ? scoreTitle(inputTitle, meta.title) : 0;
      const aScore =
        inputAuthor && meta.author ? scoreAuthor(inputAuthor, meta.author) : inputAuthor ? 0 : 1; // slight neutral when no author
      const total = tScore * 2 + aScore;
      return { meta, tScore, aScore, total };
    })
    .sort((a, b) => b.total - a.total);

  const best = candidates[0];
  if (!best) return null;

  // Acceptance thresholds
  const strict = params.mode === 'strict';

  // In strict mode, require:
  // - good title score
  // - if we have an inferred author, require some author score
  if (strict) {
    const titleOk = best.tScore >= 5;
    const authorOk = inputAuthor ? best.aScore >= 2 : true;
    const totalOk = best.total >= 12;

    if (!titleOk || !authorOk || !totalOk) return null;
    return best.meta;
  }

  // Flexible mode: accept strong title match even if author is imperfect
  const flexibleOk = best.tScore >= 4 && best.total >= 8;
  if (!flexibleOk) return null;

  return best.meta;
}
