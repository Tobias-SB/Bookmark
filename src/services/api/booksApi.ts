// src/services/api/booksApi.ts
import { fakeHttpGet } from './httpClient';

export interface ExternalBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  pageCount?: number;
}

export async function searchBooks(query: string): Promise<ExternalBook[]> {
  if (!query.trim()) {
    return [];
  }

  const mock: ExternalBook[] = [
    {
      id: 'ext-1',
      title: `Mock Book for "${query}"`,
      author: 'Mock Author',
      description: 'This is a mocked book result.',
      pageCount: 320,
    },
  ];

  const response = await fakeHttpGet(mock);
  return response.data;
}
