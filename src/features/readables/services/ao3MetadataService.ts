// src/features/readables/services/ao3MetadataService.ts
import cheerio from 'react-native-cheerio';
import type { Ao3Rating } from '../types';
import { extractAo3WorkIdFromUrl } from '@src/utils/text';

export interface Ao3WorkMetadata {
  title: string | null;
  author: string | null;
  rating: Ao3Rating | null;
  fandoms: string[];
  relationships: string[];
  characters: string[];
  tags: string[]; // additional / freeform tags
  warnings: string[];
  wordCount: number | null;
  /**
   * Number of chapters currently published/available on AO3.
   * For completed works this is also the total number of chapters.
   */
  chapterCount: number | null;
  /**
   * Whether the work is complete. This is inferred from the chapter string
   * when possible (e.g. "10/10" → complete), otherwise left as null.
   */
  complete: boolean | null;
  // AO3 "Summary" block
  summary: string | null;
}

export function extractAo3WorkId(url: string): string | null {
  return extractAo3WorkIdFromUrl(url);
}

function buildCanonicalAo3WorkUrl(workId: string): string {
  // view_adult=true avoids the interstitial for adult works
  return `https://archiveofourown.org/works/${workId}?view_adult=true`;
}

function mapRatingTextToCode(text: string | null): Ao3Rating | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();

  if (normalized.startsWith('general')) return 'G';
  if (normalized.startsWith('teen')) return 'T';
  if (normalized.startsWith('mature')) return 'M';
  if (normalized.startsWith('explicit')) return 'E';
  if (normalized.startsWith('not rated')) return 'NR';

  return null;
}

function parseIntOrNull(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, '').trim();
  const num = Number.parseInt(cleaned, 10);
  return Number.isNaN(num) ? null : num;
}

/**
 * Parse AO3's "Chapters" field.
 *
 * Examples of input:
 * - "3/10" → current = 3, total = 10, complete = false
 * - "10/10" → current = 10, total = 10, complete = true
 * - "46/?" → current = 46, total unknown, complete = null
 * - "21"   → current = 21, total unknown, complete = null
 *
 * We treat `chapterCount` as "chapters currently available".
 * For completed works this is also the total.
 */
function parseChapters(chaptersText: string | null): {
  chapterCount: number | null;
  complete: boolean | null;
} {
  if (!chaptersText) return { chapterCount: null, complete: null };

  const raw = chaptersText.trim();

  // Common case: "current/total"
  const parts = raw.split('/').map((s) => s.trim());

  if (parts.length === 2) {
    const [currentRaw, totalRaw] = parts;
    const current = parseIntOrNull(currentRaw);
    const total = totalRaw === '?' ? null : parseIntOrNull(totalRaw);

    // If we at least know how many chapters are currently published, keep that.
    if (current != null) {
      const isComplete = total != null ? current === total : null;
      return { chapterCount: current, complete: isComplete };
    }

    // Fallback: couldn't parse current, but maybe we know a total.
    if (total != null) {
      return { chapterCount: total, complete: null };
    }

    return { chapterCount: null, complete: null };
  }

  // Weird/legacy case: just a single number like "21"
  const single = parseIntOrNull(raw);
  return {
    chapterCount: single,
    complete: null,
  };
}

function detectLockedWork($: any): boolean {
  const maybeLocked = $('p').filter((_: number, el: any) => {
    const text = $(el).text();
    return text.includes('only available to registered users of Archive of Our Own');
  });

  return maybeLocked.length > 0;
}

export async function fetchAo3Metadata(rawUrl: string): Promise<Ao3WorkMetadata> {
  const workId = extractAo3WorkId(rawUrl);
  if (!workId) {
    throw new Error('Invalid AO3 work URL');
  }

  const url = buildCanonicalAo3WorkUrl(workId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'BookmarkApp/1.0 (personal reading tracker)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load AO3 work page (status ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  if (detectLockedWork($)) {
    throw new Error(
      'This work is locked on AO3 and can only be viewed when logged in. Metadata cannot be fetched automatically.',
    );
  }

  const title = $('h2.title').first().text().trim() || null;
  const author = $('a[rel="author"]').first().text().trim() || null;

  const ratingText = $('dd.rating').first().text().trim() || null;
  const rating = mapRatingTextToCode(ratingText);

  const fandoms = $('dd.fandom a.tag')
    .map((_: number, el: any) => $(el).text().trim())
    .get();

  const relationships = $('dd.relationship a.tag')
    .map((_: number, el: any) => $(el).text().trim())
    .get();

  const characters = $('dd.character a.tag')
    .map((_: number, el: any) => $(el).text().trim())
    .get();

  const tags = $('dd.freeform a.tag')
    .map((_: number, el: any) => $(el).text().trim())
    .get();

  const warnings = $('dd.warning a.tag')
    .map((_: number, el: any) => $(el).text().trim())
    .get();

  const wordsText = $('dd.words').first().text().trim() || null;
  const wordCount = parseIntOrNull(wordsText);

  const chaptersText = $('dd.chapters').first().text().trim() || null;
  const { chapterCount, complete } = parseChapters(chaptersText);

  // AO3 "Summary" block:
  // <div class="summary module">
  //   <h3>Summary:</h3>
  //   <blockquote class="userstuff">
  //     <p>...</p>
  //   </blockquote>
  // </div>
  const summaryText = $('div.summary.module blockquote.userstuff').first().text().trim() || null;

  return {
    title,
    author,
    rating,
    fandoms,
    relationships,
    characters,
    tags,
    warnings,
    wordCount,
    chapterCount,
    complete,
    summary: summaryText,
  };
}
