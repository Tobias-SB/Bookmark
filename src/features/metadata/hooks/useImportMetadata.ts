// src/features/metadata/hooks/useImportMetadata.ts
// §6 — Hook that wraps metadata services and tracks loading state.
// Import is always triggered by an explicit user action — never automatic.
//
// Dispatches to the correct service based on kind:
//   'book'   → searchGoogleBooks(query)
//   'fanfic' → fetchAo3Metadata(url)
//
// Both services never throw — this hook surfaces their MetadataResult directly.

import { useState } from 'react';
import type { MetadataResult } from '../services/types';
import { searchGoogleBooks } from '../services/googleBooksService';
import { fetchAo3Metadata } from '../services/ao3Parser';

export interface UseImportMetadataResult {
  /**
   * Call with the kind and a search query (book) or AO3 work URL (fanfic).
   * Returns MetadataResult — never throws. Safe to call from any event handler.
   */
  importMetadata: (kind: 'book' | 'fanfic', input: string) => Promise<MetadataResult>;
  /** True while a fetch is in progress. */
  isImporting: boolean;
}

export function useImportMetadata(): UseImportMetadataResult {
  const [isImporting, setIsImporting] = useState(false);

  async function importMetadata(
    kind: 'book' | 'fanfic',
    input: string,
  ): Promise<MetadataResult> {
    if (isImporting) {
      return { data: {}, errors: ['An import is already in progress.'] };
    }

    setIsImporting(true);
    try {
      return kind === 'fanfic'
        ? await fetchAo3Metadata(input)
        : await searchGoogleBooks(input);
    } catch {
      // Both services are designed to never throw, but catch defensively.
      return { data: {}, errors: ['Unexpected error during import.'] };
    } finally {
      setIsImporting(false);
    }
  }

  return { importMetadata, isImporting };
}
