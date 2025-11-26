// src/features/readables/services/bookMetadataService.ts

export interface BookMetadata {
  title: string | null;
  author: string | null;
  pageCount: number | null;
  genres: string[];
}

/**
 * Placeholder for future book metadata lookup (Open Library, Google Books, etc.).
 * Right now this always throws so the flow falls back to manual entry.
 */
export async function fetchBookMetadata(
  title: string,
  author?: string | null,
): Promise<BookMetadata> {
  // TODO: Implement using an external books API.
  // For now we signal "no metadata" by throwing.
  throw new Error('Book metadata lookup is not implemented yet.');
}
