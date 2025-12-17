import {
  fetchBookMetadata as fetchBookMetadataApi,
  type BookMetadata,
} from '@src/services/api/booksApi';

/**
 * Readables-facing book metadata service.
 *
 * Behavioral contract (the UI relies on this):
 * - Returns `BookMetadata` when a match is found.
 * - Returns `null` when the lookup succeeds but no match exists.
 * - Throws structured errors for network/server/etc (and a special NOT_IMPLEMENTED while stubbed).
 *
 * IMPORTANT:
 * - This function must NOT “invent” metadata.
 * - It should only normalize inputs and compose a query.
 */
export type { BookMetadata };

export async function fetchBookMetadata(
  title: string,
  author?: string | null,
): Promise<BookMetadata | null> {
  const t = title.trim();
  const a = (author ?? '').trim();

  // If the query is unusable, treat it as “no match” (not an error).
  if (!t) return null;

  const query = a ? `${t} ${a}` : t;

  return fetchBookMetadataApi({ query });
}
