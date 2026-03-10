// src/features/metadata/hooks/useImportMetadata.ts
// §6 — Hook that wraps metadata services and tracks loading state.
// Import is always triggered by an explicit user action — never automatic.
//
// Book flow:
//   searchBooks(query) → populates bookSearchResults for the UI to display.
//   clearBookResults() → dismisses the results (e.g. after selection or kind change).
//
// Fanfic flow:
//   importMetadata('fanfic', url) → fetches AO3 metadata; returns MetadataResult directly.

import { useCallback, useState } from 'react';
import type { BookSearchResponse, BookSearchResult, MetadataResult } from '../services/types';
import { searchGoogleBooksMultiple } from '../services/googleBooksService';
import { fetchAo3Metadata } from '../services/ao3Parser';

export interface UseImportMetadataResult {
  /**
   * Import fanfic metadata from an AO3 URL.
   * Returns MetadataResult — never throws. Safe to call from any event handler.
   */
  importMetadata: (kind: 'fanfic', input: string) => Promise<MetadataResult>;
  /**
   * Search Google Books and populate bookSearchResults with up to 5 editions.
   * Returns the response so the caller can check result count synchronously.
   * Never throws.
   */
  searchBooks: (query: string) => Promise<BookSearchResponse>;
  /** Results from the last book search. Null until a search completes with results. */
  bookSearchResults: BookSearchResult[] | null;
  /** Clear book search results — call after the user selects an edition or dismisses. */
  clearBookResults: () => void;
  /** True while a fetch is in progress. */
  isImporting: boolean;
}

export function useImportMetadata(): UseImportMetadataResult {
  const [isImporting, setIsImporting] = useState(false);
  const [bookSearchResults, setBookSearchResults] = useState<BookSearchResult[] | null>(null);

  const clearBookResults = useCallback(() => {
    setBookSearchResults(null);
  }, []);

  async function importMetadata(
    kind: 'fanfic',
    input: string,
  ): Promise<MetadataResult> {
    if (isImporting) {
      return { data: {}, errors: ['An import is already in progress.'] };
    }
    setIsImporting(true);
    try {
      return await fetchAo3Metadata(input);
    } catch {
      return { data: {}, errors: ['Unexpected error during import.'] };
    } finally {
      setIsImporting(false);
    }
  }

  async function searchBooks(query: string): Promise<BookSearchResponse> {
    if (isImporting) {
      return { results: [], errors: ['An import is already in progress.'] };
    }
    setIsImporting(true);
    try {
      const response = await searchGoogleBooksMultiple(query);
      if (response.results.length > 0) {
        setBookSearchResults(response.results);
      }
      return response;
    } catch {
      return { results: [], errors: ['Unexpected error during book search.'] };
    } finally {
      setIsImporting(false);
    }
  }

  return { importMetadata, searchBooks, bookSearchResults, clearBookResults, isImporting };
}
