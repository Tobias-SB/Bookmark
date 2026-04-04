// src/features/metadata/services/ao3Parser.ts
// §6 — AO3 metadata service. JS-only HTML extraction — no DOM APIs.
// Returns Promise<MetadataResult>. Never throws — all errors caught internally.
// Per-field extraction so partial results succeed.
//
// AO3 tag categories collected in tags[]: fandom, relationship, character, freeform.
// Rating and archive-warning tags are extracted into their own fields, not tags[].
//
// Chapter extraction:
//   AO3 format "X/Y" where X = chapters published, Y = planned total (or "?").
//   X → availableChapters (author's published count; NOT the user's reading position).
//   Y → totalUnits (planned final count; null when "?").
//   progressCurrent is never set from import — it is the user's reading position only.
//
// isComplete detection:
//   Primary: dt.status text — "Completed:" → true, "Updated:" → false.
//   Fallback (when dt.status absent): availableChapters === totalUnits && totalUnits !== null.

import type { AO3Rating, AuthorType } from '../../readables/index';
import type { MetadataResult } from './types';

const AO3_BASE_URL = 'https://archiveofourown.org/works/';
const AO3_WORKS_PATTERN = /archiveofourown\.org\/works\/(\d+)/;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Extract numeric AO3 work ID from a works URL. */
function extractWorkId(url: string): string | null {
  return url.match(AO3_WORKS_PATTERN)?.[1] ?? null;
}

/**
 * Strip all HTML tags from a fragment and decode common HTML entities.
 * Collapses internal whitespace to single spaces.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTitle(html: string): string | null {
  const match = html.match(/<h2[^>]*class="title heading"[^>]*>([\s\S]*?)<\/h2>/i);
  if (!match) return null;
  return cleanHtml(match[1]) || null;
}

function parseAuthor(html: string): string | null {
  const match = html.match(/<a[^>]*rel="author"[^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  return cleanHtml(match[1]) || null;
}

/**
 * Inspect the <a rel="author"> href to determine the author account type.
 * Returns forceAuthorNull=true when the author name should be set to null.
 */
function parseAuthorType(html: string): { authorType: AuthorType; forceAuthorNull: boolean } {
  // Match <a> tag with rel="author" regardless of attribute order
  const tagMatch = html.match(/<a\s[^>]*rel="author"[^>]*>/i);
  if (!tagMatch) {
    // No rel="author" link = Anonymous work
    return { authorType: 'anonymous', forceAuthorNull: true };
  }

  const hrefMatch = tagMatch[0].match(/href="([^"]*)"/i);
  const href = hrefMatch?.[1] ?? '';

  if (href.includes('/users/orphan_account')) {
    return { authorType: 'orphaned', forceAuthorNull: true };
  }
  return { authorType: 'known', forceAuthorNull: false };
}

function parseSummary(html: string): string | null {
  const markerIdx = html.indexOf('class="summary module"');
  if (markerIdx === -1) return null;

  const area = html.substring(markerIdx, markerIdx + 6000);

  const bqOpenIdx = area.indexOf('<blockquote');
  if (bqOpenIdx === -1) return null;

  const contentStart = area.indexOf('>', bqOpenIdx) + 1;
  const contentEnd = area.indexOf('</blockquote>', bqOpenIdx);
  if (contentEnd <= contentStart) return null;

  return cleanHtml(area.substring(contentStart, contentEnd)) || null;
}

function extractTagsFromDd(html: string, ddClass: string): string[] {
  const escapedClass = ddClass.replace(/\s+/g, '\\s+');
  const ddMatch = html.match(
    new RegExp(`<dd[^>]*class="[^"]*${escapedClass}[^"]*">([\\s\\S]*?)<\\/dd>`, 'i'),
  );
  if (!ddMatch) return [];

  const tags: string[] = [];
  for (const m of ddMatch[1].matchAll(/<a[^>]*class="[^"]*\btag\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const tag = cleanHtml(m[1]);
    if (tag) tags.push(tag);
  }
  return tags;
}

function parseTags(html: string): string[] {
  // Collects fandom/relationship/character/freeform only.
  // Archive warnings and rating tags are extracted into their own fields.
  const categories = ['fandom tags', 'relationship tags', 'character tags', 'freeform tags'];
  const all: string[] = [];
  for (const cat of categories) {
    all.push(...extractTagsFromDd(html, cat));
  }
  return all;
}

/**
 * Maps a rating tag text string to an AO3Rating enum value.
 * Returns null and the unrecognised text if the value is not in the known set.
 */
function mapRatingText(text: string): { rating: AO3Rating | null; unrecognised: string | null } {
  const map: Record<string, AO3Rating> = {
    'General Audiences': 'general',
    'Teen And Up Audiences': 'teen',
    'Mature': 'mature',
    'Explicit': 'explicit',
    'Not Rated': 'not_rated',
  };
  const rating = map[text] ?? null;
  return { rating, unrecognised: rating === null ? text : null };
}

function parseRating(html: string): { rating: AO3Rating | null; unrecognised: string | null } {
  const ratingTags = extractTagsFromDd(html, 'rating tags');
  if (!ratingTags.length) return { rating: null, unrecognised: null };
  return mapRatingText(ratingTags[0]);
}

/**
 * Checks if any freeform tag matches "abandoned" (case-insensitive).
 * Per spec: tag stays in tags[]; only sets isAbandoned flag.
 */
function checkIsAbandoned(freeformTags: string[]): boolean {
  return freeformTags.some((t) => t.toLowerCase() === 'abandoned');
}

interface ChapterCounts {
  /** Chapters currently published by the author → availableChapters. */
  published: number | null;
  /** Planned final chapter count → totalUnits. null when "?". */
  total: number | null;
}

/**
 * AO3 chapter counts live in: <dd class="chapters">3/5</dd> or <dd class="chapters">3/?</dd>
 * The published chapter count may be wrapped in an <a> link — cleanHtml strips it.
 */
function parseChapters(html: string): ChapterCounts {
  const match = html.match(/<dd[^>]*class="chapters"[^>]*>([\s\S]*?)<\/dd>/i);
  if (!match) return { published: null, total: null };

  const text = cleanHtml(match[1]); // e.g. "3/5" or "3/?"
  const slashIdx = text.indexOf('/');
  if (slashIdx === -1) return { published: null, total: null };

  const publishedStr = text.substring(0, slashIdx).trim();
  const totalStr = text.substring(slashIdx + 1).trim();

  const published = parseInt(publishedStr, 10);
  const total = totalStr === '?' ? null : parseInt(totalStr, 10);

  return {
    published: isNaN(published) ? null : published,
    total: total !== null && isNaN(total) ? null : total,
  };
}

/**
 * Reads the dl.stats dt.status element to determine isComplete and ao3UpdatedAt.
 * Returns { isComplete: null, ao3UpdatedAt: null } when dt.status is absent —
 * the caller falls back to chapter-count comparison.
 */
function parseDtStatusBlock(html: string): { isComplete: boolean | null; ao3UpdatedAt: string | null } {
  const dtMatch = html.match(/<dt[^>]*class="[^"]*\bstatus\b[^"]*"[^>]*>([\s\S]*?)<\/dt>/i);
  if (!dtMatch) return { isComplete: null, ao3UpdatedAt: null };

  const dtText = cleanHtml(dtMatch[1]);
  let isComplete: boolean | null = null;
  if (dtText.includes('Completed')) {
    isComplete = true;
  } else if (dtText.includes('Updated')) {
    isComplete = false;
  }

  if (isComplete === null) return { isComplete: null, ao3UpdatedAt: null };

  const ddMatch = html.match(/<dd[^>]*class="[^"]*\bstatus\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
  const ao3UpdatedAt = ddMatch ? cleanHtml(ddMatch[1]) || null : null;

  return { isComplete, ao3UpdatedAt };
}

function parsePublishedAt(html: string): string | null {
  const match = html.match(/<dd[^>]*class="[^"]*\bpublished\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
  if (!match) return null;
  return cleanHtml(match[1]) || null;
}

function parseWordCount(html: string): number | null {
  const match = html.match(/<dd[^>]*class="[^"]*\bwords\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
  if (!match) return null;
  const raw = cleanHtml(match[1]).replace(/,/g, '');
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function parseSeries(html: string): {
  seriesName: string | null;
  seriesPart: number | null;
  seriesTotal: number | null;
} {
  const ddMatch = html.match(/<dd[^>]*class="[^"]*\bseries\b[^"]*"[^>]*>([\s\S]*?)<\/dd>/i);
  if (!ddMatch) return { seriesName: null, seriesPart: null, seriesTotal: null };

  const ddContent = ddMatch[1];

  // Find the position span
  const posMatch = ddContent.match(/<span[^>]*class="[^"]*\bposition\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if (!posMatch) return { seriesName: null, seriesPart: null, seriesTotal: null };

  const posContent = posMatch[1];

  // Extract series name from the <a> element within the position span
  const aMatch = posContent.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
  const seriesName = aMatch ? cleanHtml(aMatch[1]) || null : null;

  // Extract "Part N of M" or "Part N of ?" from the position text
  const posText = cleanHtml(posContent);
  const partMatch = posText.match(/Part\s+(\d+)\s+of\s+(\d+|\?)/i);
  if (!partMatch) return { seriesName, seriesPart: null, seriesTotal: null };

  const seriesPart = parseInt(partMatch[1], 10);
  const totalStr = partMatch[2];
  const seriesTotal = totalStr === '?' ? null : parseInt(totalStr, 10);

  return {
    seriesName,
    seriesPart: isNaN(seriesPart) ? null : seriesPart,
    seriesTotal: seriesTotal !== null && isNaN(seriesTotal) ? null : seriesTotal,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and parse an AO3 work page, returning metadata as ImportedMetadata fields.
 * Accepts any URL containing an archiveofourown.org/works/<id> path.
 * Never throws.
 */
export async function fetchAo3Metadata(url: string): Promise<MetadataResult> {
  const workId = extractWorkId(url);
  if (!workId) {
    return { data: {}, errors: ['URL does not appear to be a valid AO3 work URL.'] };
  }

  const canonicalUrl = `${AO3_BASE_URL}${workId}`;
  const fetchUrl = `${canonicalUrl}?view_adult=true`;

  let html: string;
  try {
    const response = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'Bookmark/1.0 (personal reading tracker)' },
    });
    if (!response.ok) {
      return { data: {}, errors: [`AO3 request failed with status ${response.status}.`] };
    }
    html = await response.text();

    // Restricted detection: AO3 follows the login redirect transparently; the final
    // response URL reveals it. Secondary: login form present with no work title heading.
    if (response.url?.includes('/users/login')) {
      return { data: {}, errors: ['This work is restricted to logged-in AO3 users.'], isRestricted: true };
    }
    if (
      html.includes('<form') &&
      html.includes('login') &&
      !html.includes('<h2 class="title heading">')
    ) {
      return { data: {}, errors: ['This work is restricted to logged-in AO3 users.'], isRestricted: true };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { data: {}, errors: [`Failed to fetch AO3 page: ${message}`] };
  }

  const data: MetadataResult['data'] = {};
  const errors: string[] = [];

  data.sourceId = workId;
  data.sourceUrl = canonicalUrl;
  // Books-only fields — always null for AO3.
  data.isbn = null;
  data.coverUrl = null;
  // progressCurrent is never set from import — it is the user's reading position only.
  data.progressCurrent = null;

  // Safe defaults for all v2 fields — overwritten by successful extraction below.
  data.fandom = [];
  data.relationships = [];
  data.archiveWarnings = [];
  data.rating = null;
  data.authorType = null;
  data.wordCount = null;
  data.publishedAt = null;
  data.ao3UpdatedAt = null;
  data.isAbandoned = false;
  data.seriesName = null;
  data.seriesPart = null;
  data.seriesTotal = null;

  try {
    const title = parseTitle(html);
    if (title) data.title = title;
    else errors.push('Could not extract title from AO3 page.');
  } catch {
    errors.push('Error extracting title.');
  }

  try {
    data.author = parseAuthor(html);
  } catch {
    errors.push('Error extracting author.');
  }

  // authorType detection — may override data.author to null for orphaned/anonymous works.
  try {
    const { authorType, forceAuthorNull } = parseAuthorType(html);
    data.authorType = authorType;
    if (forceAuthorNull) data.author = null;
  } catch {
    errors.push('Error extracting author type.');
  }

  try {
    data.summary = parseSummary(html);
  } catch {
    errors.push('Error extracting summary.');
  }

  try {
    data.tags = parseTags(html);
  } catch {
    errors.push('Error extracting tags.');
  }

  // fandom — also present in tags[]; extracted into its own field too.
  try {
    data.fandom = extractTagsFromDd(html, 'fandom tags');
  } catch {
    errors.push('Error extracting fandom tags.');
  }

  // relationships — also present in tags[]; extracted into its own field too.
  try {
    data.relationships = extractTagsFromDd(html, 'relationship tags');
  } catch {
    errors.push('Error extracting relationship tags.');
  }

  // archiveWarnings — extracted into own field; NOT in tags[].
  try {
    data.archiveWarnings = extractTagsFromDd(html, 'warning tags');
  } catch {
    errors.push('Error extracting archive warnings.');
  }

  try {
    const { rating, unrecognised } = parseRating(html);
    data.rating = rating;
    if (unrecognised) errors.push(`Unrecognised AO3 rating: "${unrecognised}".`);
  } catch {
    errors.push('Error extracting rating.');
  }

  // isAbandoned — inferred from freeform tags; "Abandoned" tag stays in tags[].
  try {
    data.isAbandoned = checkIsAbandoned(data.tags ?? []);
  } catch {
    errors.push('Error checking isAbandoned.');
  }

  try {
    const { published, total } = parseChapters(html);
    data.availableChapters = published;
    data.totalUnits = total;

    // isComplete: primary signal is dt.status; fallback to chapter comparison.
    const { isComplete: statusIsComplete, ao3UpdatedAt } = parseDtStatusBlock(html);
    if (statusIsComplete !== null) {
      data.isComplete = statusIsComplete;
      data.ao3UpdatedAt = ao3UpdatedAt;
    } else {
      // Fallback: all planned chapters are published → complete.
      data.isComplete =
        published !== null && total !== null ? published === total : false;
      data.ao3UpdatedAt = null;
    }
  } catch {
    errors.push('Error extracting chapter counts.');
  }

  try {
    data.publishedAt = parsePublishedAt(html);
  } catch {
    errors.push('Error extracting published date.');
  }

  try {
    data.wordCount = parseWordCount(html);
  } catch {
    errors.push('Error extracting word count.');
  }

  try {
    const { seriesName, seriesPart, seriesTotal } = parseSeries(html);
    data.seriesName = seriesName;
    data.seriesPart = seriesPart;
    data.seriesTotal = seriesTotal;
  } catch {
    errors.push('Error extracting series information.');
  }

  return { data, errors };
}
