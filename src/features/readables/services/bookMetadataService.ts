// src/features/readables/services/bookMetadataService.ts

import {
  fetchBookMetadata as fetchBookMetadataApi,
  type BookMetadata,
} from '@src/services/api/booksApi';

export type { BookMetadata };

export type BookSearchMode = 'strict' | 'flexible';

/**
 * Readables-facing book metadata service.
 *
 * Contract:
 * - Returns `BookMetadata` when a match is found.
 * - Returns `null` when lookup succeeds but no match exists.
 * - Throws structured errors (`BooksApiError`) for network/server/etc.
 */
export async function fetchBookMetadata(
  title: string,
  author?: string | null,
  options?: { mode?: BookSearchMode; signal?: AbortSignal },
): Promise<BookMetadata | null> {
  const t = title.trim();
  const a = (author ?? '').trim();
  if (!t) return null;

  const mode: BookSearchMode = options?.mode ?? 'flexible';

  // Better for matching: lets the API infer title vs author
  const query = a ? `${t} by ${a}` : t;

  return fetchBookMetadataApi({
    query,
    signal: options?.signal,
    mode,
  });
}
