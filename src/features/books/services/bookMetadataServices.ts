import { useQuery } from '@tanstack/react-query';
import { searchBooks, type ExternalBook } from '@src/services/api/booksApi';

export function useBookSearch(query: string) {
  return useQuery<ExternalBook[]>({
    queryKey: ['bookSearch', query],
    enabled: !!query.trim(),
    queryFn: () => searchBooks(query),
  });
}
