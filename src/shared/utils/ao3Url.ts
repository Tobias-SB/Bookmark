// src/shared/utils/ao3Url.ts
// Pure AO3 URL parsing utility. No feature dependencies.
// Used by ao3Parser, and future Share Extension / CSV Import features.

export interface ProcessedAo3Url {
  /** Canonical work URL: https://archiveofourown.org/works/{id} */
  canonicalUrl: string;
  /** Numeric work ID. */
  workId: string;
  /** True if the original URL contained /chapters/. Used as a "mid-read" signal. */
  hasChapterPath: boolean;
}

// Domain check — must be archiveofourown.org.
const AO3_DOMAIN_PATTERN = /archiveofourown\.org/;
// Matches /works/<id> anywhere in the path — covers standard, collection-scoped, chapter, and
// query-param variants. The chapter ID in chapter URLs is a DB internal ID, not a chapter number.
const AO3_WORKS_ID_PATTERN = /\/works\/(\d+)/;
const CHAPTER_PATTERN = /\/chapters\/\d+/;

/** Returns null if the URL is not a valid AO3 work URL. */
export function processAo3Url(rawUrl: string): ProcessedAo3Url | null {
  if (!rawUrl) return null;
  if (!AO3_DOMAIN_PATTERN.test(rawUrl)) return null;
  const workMatch = rawUrl.match(AO3_WORKS_ID_PATTERN);
  if (!workMatch) return null;
  const workId = workMatch[1];
  return {
    canonicalUrl: `https://archiveofourown.org/works/${workId}`,
    workId,
    hasChapterPath: CHAPTER_PATTERN.test(rawUrl),
  };
}
