// src/services/api/ao3Api.ts
import { fakeHttpGet } from './httpClient';
import { extractAo3WorkIdFromUrl } from '@src/utils/text';

export interface Ao3Metadata {
  workId: string;
  title: string;
  author: string;
  fandoms: string[];
  relationships: string[];
  characters: string[];
  tags: string[];
  rating: 'G' | 'T' | 'M' | 'E' | 'NR';
  wordCount: number;
  complete: boolean;
  url: string;
}

export async function fetchWorkByUrl(url: string): Promise<Ao3Metadata> {
  const workId = extractAo3WorkIdFromUrl(url) ?? `mock-${Date.now().toString()}`;

  const mock: Ao3Metadata = {
    workId,
    title: 'Mock AO3 Work',
    author: 'Mock Author',
    fandoms: ['Mock Fandom'],
    relationships: ['Mock/Pairing'],
    characters: ['Mock Character'],
    tags: ['hurt/comfort', 'slow-burn'],
    rating: 'T',
    wordCount: 45000,
    complete: false,
    url,
  };

  const response = await fakeHttpGet(mock);
  return response.data;
}
