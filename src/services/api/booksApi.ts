import { fakeHttpGet } from './httpClient';

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
 * Semantics (IMPORTANT — UI relies on this):
 * - When the lookup succeeds but no match exists, return `null`.
 * - When the lookup fails (network/server/unknown), throw a structured `BooksApiError`.
 * - While this is still a stub, we throw a special NOT_IMPLEMENTED error so flows
 *   like QuickAddReadableScreen can fall back to manual entry without ambiguity.
 */
export interface BookMetadata {
  title: string | null;
  author: string | null;
  pageCount: number | null;
  genres: string[];
  /**
   * Short description / summary of the book, if available from the source API.
   * This will be mapped into the Readable's `description` field.
   */
  description: string | null;
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

/**
 * Lightweight search endpoint used by `useBookSearch`.
 * (Mocked for now.)
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

export type FetchBookMetadataParams = {
  /**
   * Free-text query. Service layer composes this from title/author/etc.
   */
  query: string;
  signal?: AbortSignal;
};

/**
 * Book metadata lookup for pre-filling a Readable (book).
 *
 * Contract:
 * - Return `BookMetadata` when a match is found.
 * - Return `null` when the request succeeds but nothing matches.
 * - Throw `BooksApiError` for network/server/unknown failures.
 *
 * Current state:
 * - Stubbed. Always throws `BooksApiNotImplementedError`.
 */
export async function fetchBookMetadata(
  _params: FetchBookMetadataParams,
): Promise<BookMetadata | null> {
  throw new BooksApiNotImplementedError();
}
