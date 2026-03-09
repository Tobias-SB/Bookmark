// src/features/metadata/services/ao3Parser.ts
// §6 — AO3 metadata service. JS-only HTML extraction — no DOM APIs.
// Returns Promise<MetadataResult>. Never throws — all errors caught internally.
// Per-field extraction so partial results succeed.
//
// AO3 tag categories collected: fandom, relationship, character, freeform (additional).
// Rating and archive-warning tags are excluded as they carry no reading-tracker value.
// (Provisional — confirm if different tag selection is desired.)
//
// isComplete is derived from chapter counts (progressTotal is source of truth):
//   isComplete = progressCurrent === progressTotal (both known and equal).

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

/**
 * AO3 title lives in: <h2 class="title heading">Title</h2>
 * The h2 content may include whitespace-only text nodes; cleanHtml handles that.
 */
function parseTitle(html: string): string | null {
  const match = html.match(/<h2[^>]*class="title heading"[^>]*>([\s\S]*?)<\/h2>/i);
  if (!match) return null;
  return cleanHtml(match[1]) || null;
}

/**
 * AO3 author lives in an <a rel="author"> link in the byline heading.
 * Anonymous works have no such link — returns null (correct per domain model).
 */
function parseAuthor(html: string): string | null {
  const match = html.match(/<a[^>]*rel="author"[^>]*>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  return cleanHtml(match[1]) || null;
}

/**
 * AO3 summary lives inside a blockquote.userstuff within div.summary.module.
 * Uses string offsets rather than regex to avoid nested-div termination problems.
 */
function parseSummary(html: string): string | null {
  const markerIdx = html.indexOf('class="summary module"');
  if (markerIdx === -1) return null;

  // Grab a forward window — summary modules are short.
  const area = html.substring(markerIdx, markerIdx + 6000);

  const bqOpenIdx = area.indexOf('<blockquote');
  if (bqOpenIdx === -1) return null;

  const contentStart = area.indexOf('>', bqOpenIdx) + 1;
  const contentEnd = area.indexOf('</blockquote>', bqOpenIdx);
  if (contentEnd <= contentStart) return null;

  return cleanHtml(area.substring(contentStart, contentEnd)) || null;
}

/**
 * Extract all <a class="tag"> text values from a specific <dd> class in the work meta block.
 * ddClass example: "freeform tags", "relationship tags"
 */
function extractTagsFromDd(html: string, ddClass: string): string[] {
  // Escape spaces in the class string for regex.
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

/**
 * Collect tags from fandom, relationship, character, and freeform (additional) tag categories.
 * Returns a flat string array.
 */
function parseTags(html: string): string[] {
  const categories = ['fandom tags', 'relationship tags', 'character tags', 'freeform tags'];
  const all: string[] = [];
  for (const cat of categories) {
    all.push(...extractTagsFromDd(html, cat));
  }
  return all;
}

interface ChapterCounts {
  current: number | null;
  total: number | null;
}

/**
 * AO3 chapter counts live in: <dd class="chapters">3/5</dd> or <dd class="chapters">3/?</dd>
 * The current chapter count may be wrapped in an <a> link — cleanHtml strips it.
 */
function parseChapters(html: string): ChapterCounts {
  const match = html.match(/<dd[^>]*class="chapters"[^>]*>([\s\S]*?)<\/dd>/i);
  if (!match) return { current: null, total: null };

  const text = cleanHtml(match[1]); // e.g. "3/5" or "3/?"
  const slashIdx = text.indexOf('/');
  if (slashIdx === -1) return { current: null, total: null };

  const currentStr = text.substring(0, slashIdx).trim();
  const totalStr = text.substring(slashIdx + 1).trim();

  const current = parseInt(currentStr, 10);
  const total = totalStr === '?' ? null : parseInt(totalStr, 10);

  return {
    current: isNaN(current) ? null : current,
    total: total !== null && isNaN(total) ? null : total,
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

  // Canonical source URL — strip any query params or path suffixes from the input.
  const canonicalUrl = `${AO3_BASE_URL}${workId}`;

  // view_adult=true bypasses the age-check interstitial for explicit-rated works.
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
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { data: {}, errors: [`Failed to fetch AO3 page: ${message}`] };
  }

  const data: MetadataResult['data'] = {};
  const errors: string[] = [];

  // sourceId and sourceUrl are derived from the validated URL — set unconditionally.
  data.sourceId = workId;
  data.sourceUrl = canonicalUrl;

  try {
    const title = parseTitle(html);
    if (title) data.title = title;
    else errors.push('Could not extract title from AO3 page.');
  } catch {
    errors.push('Error extracting title.');
  }

  try {
    // null is a valid value (anonymous work).
    data.author = parseAuthor(html);
  } catch {
    errors.push('Error extracting author.');
  }

  try {
    // null is a valid value (no summary).
    data.summary = parseSummary(html);
  } catch {
    errors.push('Error extracting summary.');
  }

  try {
    data.tags = parseTags(html);
  } catch {
    errors.push('Error extracting tags.');
  }

  try {
    const { current, total } = parseChapters(html);
    data.progressCurrent = current;
    data.progressTotal = total;
    // isComplete is derived from chapter counts — not from the "Completed" status label.
    // true only when both counts are known and current has reached total.
    data.isComplete = current !== null && total !== null ? current === total : false;
  } catch {
    errors.push('Error extracting chapter counts.');
  }

  return { data, errors };
}
