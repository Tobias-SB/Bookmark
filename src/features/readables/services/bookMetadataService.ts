// src/features/readables/services/bookMetadataService.ts

import {
  fetchBookMetadata as fetchBookMetadataApi,
  searchBookMetadataCandidates as searchCandidatesApi,
  type BookMetadata,
  type BookMetadataCandidate,
} from '@src/services/api/booksApi';

export type { BookMetadata, BookMetadataCandidate };

export type BookSearchMode = 'strict' | 'flexible';

function buildQuery(title: string, author?: string | null) {
  const t = title.trim();
  const a = (author ?? '').trim();
  if (!a) return t;
  return `${t} by ${a}`;
}

export async function fetchBookMetadata(
  title: string,
  author?: string | null,
  options?: { mode?: BookSearchMode; signal?: AbortSignal },
): Promise<BookMetadata | null> {
  const t = title.trim();
  if (!t) return null;

  const mode: BookSearchMode = options?.mode ?? 'flexible';
  const query = buildQuery(title, author);

  return fetchBookMetadataApi({
    query,
    signal: options?.signal,
    mode,
  });
}

export async function searchBookMetadataCandidates(
  title: string,
  author?: string | null,
  options?: { mode?: BookSearchMode; signal?: AbortSignal },
): Promise<BookMetadataCandidate[]> {
  const t = title.trim();
  if (!t) return [];

  const mode: BookSearchMode = options?.mode ?? 'flexible';
  const query = buildQuery(title, author);

  return searchCandidatesApi({
    query,
    signal: options?.signal,
    mode,
    maxCandidates: 6,
  });
}
