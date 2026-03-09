// src/features/metadata/services/googleBooksService.ts
// §6 — Google Books metadata service.
// Returns Promise<MetadataResult>. Never throws — all errors caught internally.
// Per-field extraction so partial results succeed.

import Constants from 'expo-constants';
import type { MetadataResult } from './types';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

// ---------------------------------------------------------------------------
// Google Books API response types (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  categories?: string[];
  pageCount?: number;
  infoLink?: string;
}

interface GoogleBooksVolume {
  id?: string;
  volumeInfo?: GoogleBooksVolumeInfo;
}

interface GoogleBooksApiResponse {
  totalItems?: number;
  items?: GoogleBooksVolume[];
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  return (Constants.expoConfig?.extra?.googleBooksApiKey as string | undefined) ?? '';
}

function mapVolumeToMetadata(volume: GoogleBooksVolume): MetadataResult {
  const data: MetadataResult['data'] = {};
  const errors: string[] = [];
  const info = volume.volumeInfo ?? {};

  try {
    const raw = info.title?.trim();
    if (raw) data.title = raw;
    else errors.push('Title not found in Google Books response.');
  } catch {
    errors.push('Error extracting title.');
  }

  try {
    // Use first author only; null when authors array is absent or empty.
    data.author = info.authors?.[0]?.trim() ?? null;
  } catch {
    errors.push('Error extracting author.');
  }

  try {
    data.summary = info.description?.trim() ?? null;
  } catch {
    errors.push('Error extracting summary.');
  }

  try {
    data.tags = Array.isArray(info.categories) ? [...info.categories] : [];
  } catch {
    errors.push('Error extracting categories.');
  }

  try {
    data.progressTotal =
      typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null;
  } catch {
    errors.push('Error extracting page count.');
  }

  // Google Books provides no reading progress — always null.
  data.progressCurrent = null;

  // books are never AO3 works — isComplete is always null.
  data.isComplete = null;

  try {
    data.sourceUrl = info.infoLink?.trim() ?? null;
  } catch {
    errors.push('Error extracting source URL.');
  }

  try {
    data.sourceId = volume.id?.trim() ?? null;
  } catch {
    errors.push('Error extracting volume ID.');
  }

  return { data, errors };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Google Books by a free-text query (title, ISBN, author, etc.).
 * Returns metadata for the first result, or an error result if nothing found.
 * Never throws.
 */
export async function searchGoogleBooks(query: string): Promise<MetadataResult> {
  if (!query.trim()) {
    return { data: {}, errors: ['Search query must not be empty.'] };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { data: {}, errors: ['Google Books API key is not configured.'] };
  }

  let responseJson: GoogleBooksApiResponse;
  try {
    const url = `${GOOGLE_BOOKS_BASE_URL}?q=${encodeURIComponent(query)}&maxResults=1&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return {
        data: {},
        errors: [`Google Books request failed with status ${response.status}.`],
      };
    }
    responseJson = (await response.json()) as GoogleBooksApiResponse;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { data: {}, errors: [`Failed to fetch Google Books data: ${message}`] };
  }

  if (!responseJson.items?.length) {
    return { data: {}, errors: ['No results found on Google Books.'] };
  }

  return mapVolumeToMetadata(responseJson.items[0]);
}
