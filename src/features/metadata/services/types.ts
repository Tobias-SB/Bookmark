// src/features/metadata/services/types.ts
// §6 — Metadata service return contract.
// Every metadata service returns Promise<MetadataResult> — never throws.
// On total failure: data is {}, errors contains a human-readable reason.
// On partial success: data contains successfully extracted fields.

import type { AO3Rating, AuthorType } from '../../readables/index';

export interface ImportedMetadata {
  title: string;
  /** null for anonymous or unavailable author. */
  author: string | null;
  summary: string | null;
  /** Flat string array. Includes fandom/relationship/character/freeform tags. Does NOT include archive warnings. */
  tags: string[];
  /** User's reading position — never set from AO3 chapter counts. */
  progressCurrent: number | null;
  /** Planned final chapter/page count. For AO3: total planned chapters (null if ongoing/unknown). */
  totalUnits: number | null;
  /** AO3 only: false = WIP, true = Complete. null for books. */
  isComplete: boolean | null;
  sourceUrl: string | null;
  /** External provider ID (e.g. Google Books volume ID, AO3 numeric work ID). */
  sourceId: string | null;
  /** ISBN-13 preferred, ISBN-10 fallback. null for AO3 and when not available. */
  isbn: string | null;
  /** Cover image URL (always HTTPS). null for AO3 and when not available. */
  coverUrl: string | null;
  /**
   * Fanfic only: chapters published by the author at scrape time.
   * Distinct from progressCurrent (user position) and totalUnits (planned final count).
   * Derived from the X in AO3's "X/Y" chapter format.
   */
  availableChapters: number | null;
  /** Fanfic only: total word count. null for books and when unavailable. */
  wordCount: number | null;
  /** Fanfic only: fandom names. Also present in the flat tags array. Empty array for books. */
  fandom: string[];
  /** Fanfic only: relationship/ship tags. Also present in the flat tags array. Empty array for books. */
  relationships: string[];
  /** Fanfic only: AO3 content rating. null for books. */
  rating: AO3Rating | null;
  /** Fanfic only: canonical AO3 archive warnings. NOT included in the tags array. Empty array for books. */
  archiveWarnings: string[];
  /** Series name — applies to all readables. null when not part of a series. */
  seriesName: string | null;
  /** Series position — applies to all readables. For books: from seriesInfo.volumeSeries[0].orderNumber. */
  seriesPart: number | null;
  /** Total works in series. Not available from Google Books — always null for book imports. */
  seriesTotal: number | null;
  /** Fanfic only: author account type derived from AO3 author link. null for books. */
  authorType: AuthorType | null;
  /** Fanfic only: ISO 8601 publication date from dl.stats dd.published. null for books. */
  publishedAt: string | null;
  /** Fanfic only: ISO 8601 date of last AO3 update from dl.stats dd.status. null for books. */
  ao3UpdatedAt: string | null;
  /** Fanfic only: inferred from presence of "Abandoned" freeform tag. false for books. */
  isAbandoned: boolean;
}

export interface MetadataResult {
  /** Successfully extracted fields. May be partial or empty on failure. */
  data: Partial<ImportedMetadata>;
  /** Human-readable error messages. Empty array on full success. */
  errors: string[];
}

/** A single edition returned by a multi-result book search. */
export interface BookSearchResult {
  /** Title for display in the results list. */
  displayTitle: string;
  /**
   * All contributors from the API's authors array — no role differentiation is
   * available from the Google Books API. The first entry is stored as `author`;
   * additional entries may include illustrators, editors, translators, etc.
   */
  allContributors: string[];
  /** Subtitle — may include edition/format info (e.g. "10th Anniversary Edition"). */
  subtitle: string | null;
  /** Publisher, year, and page count. Empty string if none available. */
  displayInfo: string;
  /** ISBN-13 preferred, ISBN-10 fallback. null if not available. */
  isbn: string | null;
  /** Cover thumbnail URL (HTTPS). null if not available. */
  coverUrl: string | null;
  /** Metadata to apply if this result is selected. */
  metadata: Partial<ImportedMetadata>;
}

/** Response from a multi-result book search. */
export interface BookSearchResponse {
  results: BookSearchResult[];
  errors: string[];
  /**
   * True if more results are available from the API for the same query.
   * Pass nextStartIndex to searchGoogleBooksMultiple to fetch the next page.
   */
  hasMore: boolean;
  /** startIndex value to pass for the next page. 0 when hasMore is false. */
  nextStartIndex: number;
}
