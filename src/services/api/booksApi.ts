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

  /**
   * Multiple authors when available from provider.
   * UI can choose how to display/edit these; existing storage can remain string-based for now.
   */
  authors: string[];

  pageCount: number | null;
  genres: string[];
  description: string | null;

  /**
   * Cover URL (Open Library Covers API). Included even if not yet used in UI.
   */
  coverUrl: string | null;
}

export type BookMetadataCandidate = {
  /**
   * Provider-specific stable-ish ID if possible (Open Library work key), else fallback.
   */
  id: string;
  score: number;
  titleScore: number;
  authorScore: number;
  metadata: BookMetadata;
};

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
   * - strict: require stronger title/author agreement
   * - flexible: allow title-heavy matches more often
   */
  mode: 'strict' | 'flexible';
};

/**
 * Lightweight search endpoint used by `useBookSearch`.
 * (Kept mocked for now.)
 */
export async function searchBooks(query: string): Promise<ExternalBook[]> {
  if (!query.trim()) return [];

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
  docs?: OpenLibrarySearchDoc[];
};

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
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

function scoreAuthor(inputAuthor: string, candidateAuthors: string[]) {
  const a = normalizeText(inputAuthor);
  if (!a) return 0;

  let best = 0;
  for (const cand of candidateAuthors) {
    const b = normalizeText(cand);
    if (!b) continue;

    if (a === b) best = Math.max(best, 6);
    else if (b.includes(a) || a.includes(b)) best = Math.max(best, 4);
    else {
      const overlap = tokenOverlapScore(a, b);
      if (overlap >= 0.7) best = Math.max(best, 4);
      else if (overlap >= 0.5) best = Math.max(best, 3);
      else if (overlap >= 0.35) best = Math.max(best, 2);
    }
  }

  return best;
}

function extractTitleAuthorFromQuery(query: string): { title: string; author: string | null } {
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

  const authors = Array.isArray(doc.author_name)
    ? doc.author_name
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

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
    authors,
    description,
    pageCount,
    genres,
    coverUrl: buildCoverUrl(doc),
  };
}

function mapHttpClientErrorToBooksApiError(err: HttpClientError): BooksApiError {
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

function isAcceptableCandidate(candidate: BookMetadataCandidate, mode: 'strict' | 'flexible') {
  const strict = mode === 'strict';

  if (strict) {
    const titleOk = candidate.titleScore >= 5;
    const authorOk = candidate.authorScore >= 2; // if author exists in query we ensure it's reflected in scoring
    const totalOk = candidate.score >= 12;
    return titleOk && authorOk && totalOk;
  }

  return candidate.titleScore >= 4 && candidate.score >= 8;
}

/**
 * Returns multiple candidates (sorted) so the UI can present a chooser.
 * Returns [] when nothing meets minimal threshold.
 */
export async function searchBookMetadataCandidates(
  params: FetchBookMetadataParams & { maxCandidates?: number },
): Promise<BookMetadataCandidate[]> {
  const query = params.query.trim();
  if (!query) return [];

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
    `&limit=12` +
    `&fields=${encodeURIComponent(fields)}`;

  let json: OpenLibrarySearchResponse;
  try {
    json = await httpGetJson<OpenLibrarySearchResponse>(url, {
      signal: params.signal,
      timeoutMs: 12_000,
    });
  } catch (cause: unknown) {
    if (cause instanceof HttpClientError) {
      throw mapHttpClientErrorToBooksApiError(cause);
    }
    throw new BooksApiError({
      kind: 'UNKNOWN',
      message: 'Books API unexpected error while requesting Open Library',
      cause,
    });
  }

  const docs = Array.isArray(json.docs) ? json.docs : [];
  if (docs.length === 0) return [];

  const inferred = extractTitleAuthorFromQuery(query);
  const inputTitle = inferred.title;
  const inputAuthor = inferred.author;

  const candidates: BookMetadataCandidate[] = docs
    .map((doc) => {
      const metadata = docToMetadata(doc);

      const titleScore = metadata.title ? scoreTitle(inputTitle, metadata.title) : 0;
      const authorScore = inputAuthor ? scoreAuthor(inputAuthor, metadata.authors) : 1; // neutral if no author
      const score = titleScore * 2 + authorScore;

      const id = doc.key ? doc.key : `${metadata.title ?? 'unknown'}-${metadata.authors.join('|')}`;

      return { id, metadata, titleScore, authorScore, score };
    })
    .filter((c) => isAcceptableCandidate(c, params.mode))
    .sort((a, b) => b.score - a.score);

  const max = params.maxCandidates ?? 6;
  return candidates.slice(0, max);
}

/**
 * Convenience: return the “best” match or null.
 * Used by code paths that don't need a chooser.
 */
export async function fetchBookMetadata(
  params: FetchBookMetadataParams,
): Promise<BookMetadata | null> {
  const candidates = await searchBookMetadataCandidates({ ...params, maxCandidates: 1 });
  return candidates[0]?.metadata ?? null;
}
