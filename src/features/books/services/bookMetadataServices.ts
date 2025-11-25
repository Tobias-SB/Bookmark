// src/features/books/services/bookMetadataService.ts
import { useQuery } from '@tanstack/react-query';
import { searchBooks } from '@src/services/api/booksApi';
import type { ExternalBook } from '../types';

export function useBookSearch(query: string) {
  return useQuery<ExternalBook[]>({
    queryKey: ['bookSearch', query],
    enabled: !!query.trim(),
    queryFn: () => searchBooks(query),
  });
}
