// src/features/readables/services/bookMetadataService.ts

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
