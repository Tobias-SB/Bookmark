// src/features/readables/hooks/useSearchVocabulary.ts
import { useMemo } from 'react';
import { useReadables } from './useReadables';
import {
  buildSearchVocabularyFromReadables,
  type SearchToken,
} from '../services/searchVocabularyService';

export interface UseSearchVocabularyResult {
  tokens: SearchToken[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Derive a search vocabulary from all readables.
 *
 * - Reuses the existing `useReadables` query (no extra DB hits).
 * - Builds a stable list of SearchToken objects.
 */
export function useSearchVocabulary(): UseSearchVocabularyResult {
  const { data: allReadables = [], isLoading, isError, error } = useReadables();

  const tokens = useMemo<SearchToken[]>(
    () => buildSearchVocabularyFromReadables(allReadables),
    [allReadables],
  );

  return {
    tokens,
    isLoading,
    isError,
    error,
  };
}
