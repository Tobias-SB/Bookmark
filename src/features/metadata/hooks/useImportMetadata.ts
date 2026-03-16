// src/features/metadata/hooks/useImportMetadata.ts
// §6 — Hook that wraps metadata services and tracks loading state.
// Import is always triggered by an explicit user action — never automatic.
//
// Book flow:
//   searchBooks(query, startIndex?) → returns BookSearchResponse directly.
//   The caller (QuickAddScreen) is responsible for accumulating paginated results.
//   startIndex defaults to 0; pass response.nextStartIndex for subsequent pages.
//
// Fanfic flow:
//   importMetadata('fanfic', url) → fetches AO3 metadata; returns MetadataResult directly.

import { useRef, useState } from 'react';
import type { BookSearchResponse, MetadataResult } from '../services/types';
import { searchGoogleBooksMultiple } from '../services/googleBooksService';
import { fetchAo3Metadata } from '../services/ao3Parser';

export interface UseImportMetadataResult {
  /**
   * Import fanfic metadata from an AO3 URL.
   * Returns MetadataResult — never throws. Safe to call from any event handler.
   */
  importMetadata: (kind: 'fanfic', input: string) => Promise<MetadataResult>;
  /**
   * Search Google Books and return up to 5 editions per page.
   * Pass startIndex=0 for a new search; pass response.nextStartIndex to load more.
   * Returns the full BookSearchResponse including hasMore and nextStartIndex.
   * Never throws.
   */
  searchBooks: (query: string, startIndex?: number) => Promise<BookSearchResponse>;
  /** True while a fetch is in progress. */
  isImporting: boolean;
}

export function useImportMetadata(): UseImportMetadataResult {
  const [isImporting, setIsImporting] = useState(false);
  // Ref-based guard so rapid concurrent calls are blocked synchronously,
  // before any async state update can commit.
  const inFlightRef = useRef(false);

  async function importMetadata(
    kind: 'fanfic',
    input: string,
  ): Promise<MetadataResult> {
    if (inFlightRef.current) {
      return { data: {}, errors: ['An import is already in progress.'] };
    }
    inFlightRef.current = true;
    setIsImporting(true);
    try {
      return await fetchAo3Metadata(input);
    } catch {
      return { data: {}, errors: ['Unexpected error during import.'] };
    } finally {
      inFlightRef.current = false;
      setIsImporting(false);
    }
  }

  async function searchBooks(query: string, startIndex: number = 0): Promise<BookSearchResponse> {
    if (inFlightRef.current) {
      return { results: [], errors: ['An import is already in progress.'], hasMore: false, nextStartIndex: 0 };
    }
    inFlightRef.current = true;
    setIsImporting(true);
    try {
      return await searchGoogleBooksMultiple(query, startIndex);
    } catch {
      return { results: [], errors: ['Unexpected error during book search.'], hasMore: false, nextStartIndex: 0 };
    } finally {
      inFlightRef.current = false;
      setIsImporting(false);
    }
  }

  return { importMetadata, searchBooks, isImporting };
}
