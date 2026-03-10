// src/features/metadata/services/googleBooksService.ts
// §6 — Google Books metadata service.
// Returns Promise<MetadataResult> (single) or Promise<BookSearchResponse> (multiple).
// Never throws — all errors caught internally.
// Per-field extraction so partial results succeed.
//
// API notes:
//   - authors[]: all contributors without role differentiation. Illustrators,
//     editors, and translators appear alongside the primary author with no
//     role label. We extract all and surface them in BookSearchResult.allContributors.
//   - Binding format (hardcover/paperback): not a structured API field. May appear
//     in subtitle for some editions.
//   - Cover thumbnails: Google Books returns http:// URLs — converted to https://.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { BookSearchResponse, BookSearchResult, MetadataResult } from './types';

const GOOGLE_BOOKS_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

// ---------------------------------------------------------------------------
// Google Books API response types (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface GoogleBooksIndustryIdentifier {
  type: string;       // "ISBN_10" | "ISBN_13" | "OTHER"
  identifier: string;
}

interface GoogleBooksImageLinks {
  thumbnail?: string;
  smallThumbnail?: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  description?: string;
  categories?: string[];
  pageCount?: number;
  publisher?: string;
  publishedDate?: string;
  infoLink?: string;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
  imageLinks?: GoogleBooksImageLinks;
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
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return Platform.OS === 'android'
    ? (extra?.googleBooksApiKeyAndroid ?? '')
    : (extra?.googleBooksApiKeyIos ?? '');
}

function getRestrictionHeaders(): Record<string, string> {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;

  if (Platform.OS === 'android') {
    const packageName = Constants.expoConfig?.android?.package ?? '';
    const cert = (extra?.googleBooksAndroidCert ?? '').replace(/:/g, '').toLowerCase();
    if (!packageName || !cert) return {};
    return {
      'X-Android-Package': packageName,
      'X-Android-Cert': cert,
    };
  }

  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? '';
  if (!bundleId) return {};
  return {
    'X-Ios-Bundle-Identifier': bundleId,
  };
}

/**
 * Extracts the preferred ISBN from industry identifiers.
 * Prefers ISBN-13; falls back to ISBN-10; returns null if neither is present.
 */
function extractIsbn(identifiers?: GoogleBooksIndustryIdentifier[]): string | null {
  if (!identifiers?.length) return null;
  const isbn13 = identifiers.find((i) => i.type === 'ISBN_13');
  if (isbn13) return isbn13.identifier;
  const isbn10 = identifiers.find((i) => i.type === 'ISBN_10');
  return isbn10?.identifier ?? null;
}

/**
 * Converts a Google Books image URL to HTTPS.
 * Google Books returns http:// thumbnail URLs; Android blocks cleartext traffic.
 */
function toHttps(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, 'https://');
}

function buildDisplayInfo(info: GoogleBooksVolumeInfo): string {
  const parts: string[] = [];
  if (info.publisher?.trim()) parts.push(info.publisher.trim());
  if (info.publishedDate?.trim()) {
    const year = info.publishedDate.trim().slice(0, 4);
    if (year) parts.push(year);
  }
  if (typeof info.pageCount === 'number' && info.pageCount > 0) {
    parts.push(`${info.pageCount} pages`);
  }
  return parts.join(' · ');
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

  data.progressCurrent = null;
  data.isComplete = null;
  data.availableChapters = null;

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

  try {
    data.isbn = extractIsbn(info.industryIdentifiers);
  } catch {
    errors.push('Error extracting ISBN.');
  }

  try {
    data.coverUrl = toHttps(info.imageLinks?.thumbnail);
  } catch {
    errors.push('Error extracting cover URL.');
  }

  return { data, errors };
}

function mapVolumeToBookSearchResult(volume: GoogleBooksVolume): BookSearchResult {
  const info = volume.volumeInfo ?? {};
  const { data } = mapVolumeToMetadata(volume);
  return {
    displayTitle: info.title?.trim() ?? 'Unknown title',
    allContributors: info.authors?.map((a) => a.trim()).filter(Boolean) ?? [],
    subtitle: info.subtitle?.trim() ?? null,
    displayInfo: buildDisplayInfo(info),
    isbn: extractIsbn(info.industryIdentifiers),
    coverUrl: toHttps(info.imageLinks?.thumbnail),
    metadata: data,
  };
}

async function fetchVolumes(
  query: string,
  maxResults: number,
): Promise<{ items: GoogleBooksVolume[]; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { items: [], error: 'Google Books API key is not configured.' };
  }

  try {
    const url = `${GOOGLE_BOOKS_BASE_URL}?q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;
    const response = await fetch(url, { headers: getRestrictionHeaders() });
    if (!response.ok) {
      return { items: [], error: `Google Books request failed with status ${response.status}.` };
    }
    const json = (await response.json()) as GoogleBooksApiResponse;
    return { items: json.items ?? [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { items: [], error: `Failed to fetch Google Books data: ${message}` };
  }
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

  const { items, error } = await fetchVolumes(query.trim(), 1);
  if (error) return { data: {}, errors: [error] };
  if (!items.length) return { data: {}, errors: ['No results found on Google Books.'] };

  return mapVolumeToMetadata(items[0]);
}

/**
 * Search Google Books and return up to 5 results for the user to choose from.
 * Each result includes contributor list, subtitle, edition info, ISBN, and
 * cover URL to help distinguish editions. Never throws.
 */
export async function searchGoogleBooksMultiple(query: string): Promise<BookSearchResponse> {
  if (!query.trim()) {
    return { results: [], errors: ['Search query must not be empty.'] };
  }

  const { items, error } = await fetchVolumes(query.trim(), 5);
  if (error) return { results: [], errors: [error] };
  if (!items.length) return { results: [], errors: ['No results found on Google Books.'] };

  const results = items.map(mapVolumeToBookSearchResult);
  return { results, errors: [] };
}
