// src/features/metadata/services/ao3Parser.ts
// §6 — AO3 metadata service. JS-only HTML extraction — no DOM APIs.
// Returns Promise<MetadataResult>. Never throws — all errors caught internally.
// Per-field extraction so partial results succeed.
//
// AO3 tag categories collected: fandom, relationship, character, freeform (additional).
// Rating and archive-warning tags are excluded as they carry no reading-tracker value.
// (Provisional — confirm if different tag selection is desired.)
//
// Chapter extraction:
//   AO3 format "X/Y" where X = chapters published, Y = planned total (or "?").
//   X → availableChapters (author's published count; NOT the user's reading position).
//   Y → progressTotal (planned final count; null when "?").
//   progressCurrent is never set from import — it is the user's reading position only.
//   isComplete = availableChapters === progressTotal (both known and equal).

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
  const categories = ['fandom tags', 'relationship tags', 'character tags', 'freeform tags'];
  const all: string[] = [];
  for (const cat of categories) {
    all.push(...extractTagsFromDd(html, cat));
  }
  return all;
}

interface ChapterCounts {
  /** Chapters currently published by the author → availableChapters. */
  published: number | null;
  /** Planned final chapter count → progressTotal. null when "?". */
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

  try {
    const { published, total } = parseChapters(html);
    // published = chapters the author has posted → availableChapters (not user progress).
    // total = planned final chapter count → progressTotal (null when ongoing/unknown).
    data.availableChapters = published;
    data.progressTotal = total;
    // isComplete: true only when all planned chapters are published.
    data.isComplete = published !== null && total !== null ? published === total : false;
  } catch {
    errors.push('Error extracting chapter counts.');
  }

  return { data, errors };
}
