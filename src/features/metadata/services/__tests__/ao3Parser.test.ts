// src/features/metadata/services/__tests__/ao3Parser.test.ts
// §14 — Unit tests for fetchAo3Metadata HTML parsing.
// fetch is mocked — no real network requests. Tests the extraction logic
// against synthetic HTML fragments representative of real AO3 page structure.

import { fetchAo3Metadata } from '../ao3Parser';

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ── HTML fixtures ─────────────────────────────────────────────────────────────

const VALID_WORK_URL = 'https://archiveofourown.org/works/12345';

function makeHtml({
  title = 'My Test Work',
  author = 'TestAuthor',
  authorHref = '/users/TestAuthor/pseuds/TestAuthor',
  summary = 'A test summary.',
  chapters = '3/5',
  fandomTags = ['My Fandom'],
  relTags = ['A/B'],
  charTags = ['Char A'],
  freeformTags = ['Tag One', 'Tag Two'],
  ratingTags = ['Teen And Up Audiences'],
  warningTags = ['No Archive Warnings Apply'],
  seriesBlock = null,
  // Stats block fields — only emitted when provided
  publishedDate,
  statusLabel,
  statusDate = '2025-03-01',
  wordCountStr,
}: {
  title?: string;
  author?: string | null;
  authorHref?: string;
  summary?: string | null;
  chapters?: string;
  fandomTags?: string[];
  relTags?: string[];
  charTags?: string[];
  freeformTags?: string[];
  ratingTags?: string[];
  warningTags?: string[];
  seriesBlock?: string | null;
  publishedDate?: string;
  statusLabel?: 'Completed:' | 'Updated:';
  statusDate?: string;
  wordCountStr?: string;
} = {}): string {
  const authorHtml =
    author !== null
      ? `<a rel="author" href="${authorHref}">${author}</a>`
      : '';

  const summaryHtml =
    summary !== null
      ? `<div class="summary module"><h3 class="heading">Summary:</h3><blockquote class="userstuff"><p>${summary}</p></blockquote></div>`
      : '';

  const tagsHtml = (ddClass: string, tags: string[]) =>
    tags.length > 0
      ? `<dd class="${ddClass}"><ul class="commas">${tags.map((t) => `<li><a class="tag" href="#">${t}</a></li>`).join('')}</ul></dd>`
      : '';

  // Stats block — only emitted when at least one stats field is provided.
  const hasStats = publishedDate !== undefined || statusLabel !== undefined || wordCountStr !== undefined;
  const statsBlock = hasStats
    ? `<dl class="stats">
        ${publishedDate !== undefined ? `<dt class="published">Published:</dt><dd class="published">${publishedDate}</dd>` : ''}
        ${statusLabel !== undefined ? `<dt class="status">${statusLabel}</dt><dd class="status">${statusDate}</dd>` : ''}
        ${wordCountStr !== undefined ? `<dt class="words">Words:</dt><dd class="words">${wordCountStr}</dd>` : ''}
      </dl>`
    : '';

  const seriesHtml = seriesBlock
    ? `<dd class="series"><span class="series"><span class="position">${seriesBlock}</span></span></dd>`
    : '';

  return `
    <html>
    <body>
      <h2 class="title heading">${title}</h2>
      <h3 class="byline heading">by ${authorHtml}</h3>
      ${summaryHtml}
      <dl class="work meta group">
        <dd class="chapters">${chapters}</dd>
        ${tagsHtml('rating tags', ratingTags)}
        ${tagsHtml('warning tags', warningTags)}
        ${tagsHtml('fandom tags', fandomTags)}
        ${tagsHtml('relationship tags', relTags)}
        ${tagsHtml('character tags', charTags)}
        ${tagsHtml('freeform tags', freeformTags)}
        ${seriesHtml}
        ${statsBlock}
      </dl>
    </body>
    </html>
  `;
}

function respondWith(html: string, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(html),
  });
}

// ── URL validation ────────────────────────────────────────────────────────────

describe('invalid URL', () => {
  it('returns error immediately without fetching', async () => {
    const result = await fetchAo3Metadata('https://example.com/not-ao3');
    expect(result.data).toEqual({});
    expect(result.errors).toHaveLength(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error for empty string URL', async () => {
    const result = await fetchAo3Metadata('');
    expect(result.data).toEqual({});
    expect(result.errors).toHaveLength(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Network errors ────────────────────────────────────────────────────────────

describe('network failure', () => {
  it('returns error result without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/fetch/i);
  });

  it('returns error result for non-OK HTTP status', async () => {
    respondWith('', 404);
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/404/);
  });
});

// ── Successful extraction ─────────────────────────────────────────────────────

describe('successful extraction', () => {
  it('extracts sourceId and canonical sourceUrl from the work URL', async () => {
    respondWith(makeHtml());
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.sourceId).toBe('12345');
    expect(result.data.sourceUrl).toBe('https://archiveofourown.org/works/12345');
  });

  it('uses the canonical URL even when the input has query params', async () => {
    respondWith(makeHtml());
    const result = await fetchAo3Metadata(
      'https://archiveofourown.org/works/12345?view_adult=true',
    );
    expect(result.data.sourceId).toBe('12345');
    expect(result.data.sourceUrl).toBe('https://archiveofourown.org/works/12345');
  });

  it('extracts title', async () => {
    respondWith(makeHtml({ title: 'The Works of Ages' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.title).toBe('The Works of Ages');
  });

  it('extracts author for a known author', async () => {
    respondWith(makeHtml({ author: 'FanficWriter42' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.author).toBe('FanficWriter42');
  });

  it('extracts null for anonymous work (no rel=author link)', async () => {
    respondWith(makeHtml({ author: null }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.author).toBeNull();
  });

  it('extracts summary', async () => {
    respondWith(makeHtml({ summary: 'A gripping tale of adventure.' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.summary).toBe('A gripping tale of adventure.');
  });

  it('sets summary to null when no summary block present', async () => {
    respondWith(makeHtml({ summary: null }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.summary).toBeNull();
  });

  it('extracts chapter counts for a WIP work (N/?)', async () => {
    respondWith(makeHtml({ chapters: '3/?' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    // X → availableChapters (author's published count); progressCurrent never set from import
    expect(result.data.availableChapters).toBe(3);
    expect(result.data.progressCurrent).toBeNull();
    expect(result.data.totalUnits).toBeNull();
    expect(result.data.isComplete).toBe(false);
  });

  it('extracts chapter counts for a complete work (N/N → isComplete=true)', async () => {
    respondWith(makeHtml({ chapters: '10/10' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.availableChapters).toBe(10);
    expect(result.data.progressCurrent).toBeNull();
    expect(result.data.totalUnits).toBe(10);
    expect(result.data.isComplete).toBe(true);
  });

  it('extracts chapter counts for a multi-chapter partial work', async () => {
    respondWith(makeHtml({ chapters: '7/20' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.availableChapters).toBe(7);
    expect(result.data.progressCurrent).toBeNull();
    expect(result.data.totalUnits).toBe(20);
    expect(result.data.isComplete).toBe(false);
  });

  it('collects tags from fandom/relationship/character/freeform into a flat array', async () => {
    respondWith(
      makeHtml({
        fandomTags: ['Fandom A'],
        relTags: ['Char X/Char Y'],
        charTags: ['Char X', 'Char Y'],
        freeformTags: ['Slow Burn', 'Happy Ending'],
      }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.tags).toEqual([
      'Fandom A',
      'Char X/Char Y',
      'Char X',
      'Char Y',
      'Slow Burn',
      'Happy Ending',
    ]);
  });

  it('returns empty tags array when no tag categories present', async () => {
    respondWith(
      makeHtml({ fandomTags: [], relTags: [], charTags: [], freeformTags: [], ratingTags: [], warningTags: [] }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.tags).toEqual([]);
  });

  it('returns no errors on a fully populated page', async () => {
    respondWith(makeHtml());
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.errors).toHaveLength(0);
  });

  it('appends an error when title is missing but still returns other fields', async () => {
    // HTML with no title h2
    respondWith('<html><body><dd class="chapters">1/5</dd></body></html>');
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.title).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
    // sourceId and sourceUrl are always set when URL is valid
    expect(result.data.sourceId).toBe('12345');
  });

  it('fetch is called with the view_adult bypass URL', async () => {
    respondWith(makeHtml());
    await fetchAo3Metadata(VALID_WORK_URL);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('view_adult=true'),
      expect.any(Object),
    );
  });
});

// ── authorType detection ──────────────────────────────────────────────────────

describe('authorType detection', () => {
  it('detects known author from a normal /users/ href', async () => {
    respondWith(makeHtml({ author: 'SomeWriter', authorHref: '/users/SomeWriter/pseuds/SomeWriter' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.authorType).toBe('known');
    expect(result.data.author).toBe('SomeWriter');
  });

  it('detects anonymous when no rel=author link is present', async () => {
    respondWith(makeHtml({ author: null }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.authorType).toBe('anonymous');
    expect(result.data.author).toBeNull();
  });

  it('detects orphaned from orphan_account href and sets author to null', async () => {
    respondWith(
      makeHtml({
        author: 'orphan_account',
        authorHref: '/users/orphan_account/pseuds/orphan_account',
      }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.authorType).toBe('orphaned');
    expect(result.data.author).toBeNull();
  });
});

// ── rating extraction ─────────────────────────────────────────────────────────

describe('rating extraction', () => {
  it.each([
    ['General Audiences', 'general'],
    ['Teen And Up Audiences', 'teen'],
    ['Mature', 'mature'],
    ['Explicit', 'explicit'],
    ['Not Rated', 'not_rated'],
  ] as const)('maps "%s" to %s', async (tag, expected) => {
    respondWith(makeHtml({ ratingTags: [tag] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.rating).toBe(expected);
    expect(result.errors).toHaveLength(0);
  });

  it('returns null and appends an error for an unrecognised rating tag', async () => {
    respondWith(makeHtml({ ratingTags: ['Unknown Rating Value'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.rating).toBeNull();
    expect(result.errors.some((e) => e.includes('Unknown Rating Value'))).toBe(true);
  });

  it('returns null rating when no rating tags present', async () => {
    respondWith(makeHtml({ ratingTags: [] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.rating).toBeNull();
  });
});

// ── archiveWarnings extraction ────────────────────────────────────────────────

describe('archiveWarnings extraction', () => {
  it('extracts archive warnings into archiveWarnings array', async () => {
    respondWith(
      makeHtml({ warningTags: ['Graphic Depictions Of Violence', 'Major Character Death'] }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.archiveWarnings).toEqual([
      'Graphic Depictions Of Violence',
      'Major Character Death',
    ]);
  });

  it('archive warnings are NOT present in the tags array', async () => {
    respondWith(
      makeHtml({
        warningTags: ['Graphic Depictions Of Violence'],
        freeformTags: ['Angst'],
      }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.tags).not.toContain('Graphic Depictions Of Violence');
    expect(result.data.archiveWarnings).toContain('Graphic Depictions Of Violence');
  });

  it('returns empty archiveWarnings when no warning tags present', async () => {
    respondWith(makeHtml({ warningTags: [] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.archiveWarnings).toEqual([]);
  });
});

// ── fandom extraction ─────────────────────────────────────────────────────────

describe('fandom extraction', () => {
  it('extracts a single fandom into fandom field', async () => {
    respondWith(makeHtml({ fandomTags: ['My Little Pony'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.fandom).toEqual(['My Little Pony']);
  });

  it('extracts multiple fandoms for a crossover work', async () => {
    respondWith(makeHtml({ fandomTags: ['Fandom A', 'Fandom B', 'Fandom C'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.fandom).toEqual(['Fandom A', 'Fandom B', 'Fandom C']);
  });

  it('fandom strings appear in both fandom field and tags array', async () => {
    respondWith(makeHtml({ fandomTags: ['The Untamed'], relTags: [], charTags: [], freeformTags: [] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.fandom).toContain('The Untamed');
    expect(result.data.tags).toContain('The Untamed');
  });

  it('returns empty fandom array when no fandom tags present', async () => {
    respondWith(makeHtml({ fandomTags: [] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.fandom).toEqual([]);
  });
});

// ── relationships extraction ──────────────────────────────────────────────────

describe('relationships extraction', () => {
  it('extracts relationship tags into relationships field', async () => {
    respondWith(makeHtml({ relTags: ['Wei Wuxian/Lan Wangji', 'Nie Huaisang & Nie Mingjue'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.relationships).toEqual([
      'Wei Wuxian/Lan Wangji',
      'Nie Huaisang & Nie Mingjue',
    ]);
  });

  it('returns empty relationships array when no relationship tags present', async () => {
    respondWith(makeHtml({ relTags: [] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.relationships).toEqual([]);
  });
});

// ── isAbandoned inference ─────────────────────────────────────────────────────

describe('isAbandoned inference', () => {
  it('sets isAbandoned=true when "Abandoned" freeform tag is present', async () => {
    respondWith(makeHtml({ freeformTags: ['Abandoned', 'Slow Burn'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isAbandoned).toBe(true);
  });

  it('sets isAbandoned=true case-insensitively ("abandoned" lowercase)', async () => {
    respondWith(makeHtml({ freeformTags: ['abandoned'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isAbandoned).toBe(true);
  });

  it('sets isAbandoned=false when no "Abandoned" tag present', async () => {
    respondWith(makeHtml({ freeformTags: ['Slow Burn', 'Happy Ending'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isAbandoned).toBe(false);
  });

  it('"Abandoned" tag remains in the tags array after inference', async () => {
    respondWith(makeHtml({ freeformTags: ['Abandoned', 'Hurt/Comfort'] }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.tags).toContain('Abandoned');
    expect(result.data.isAbandoned).toBe(true);
  });
});

// ── publishedAt extraction ────────────────────────────────────────────────────

describe('publishedAt extraction', () => {
  it('extracts ISO date from dd.published in the stats block', async () => {
    respondWith(makeHtml({ publishedDate: '2024-01-15' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.publishedAt).toBe('2024-01-15');
  });

  it('returns null publishedAt when dd.published is absent', async () => {
    respondWith(makeHtml()); // no stats block emitted
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.publishedAt).toBeNull();
  });
});

// ── ao3UpdatedAt and isComplete via dt.status ─────────────────────────────────

describe('ao3UpdatedAt and isComplete via dt.status', () => {
  it('sets isComplete=true and ao3UpdatedAt from "Completed:" label', async () => {
    respondWith(
      makeHtml({ statusLabel: 'Completed:', statusDate: '2025-12-01', chapters: '10/10' }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isComplete).toBe(true);
    expect(result.data.ao3UpdatedAt).toBe('2025-12-01');
  });

  it('sets isComplete=false and ao3UpdatedAt from "Updated:" label', async () => {
    respondWith(
      makeHtml({ statusLabel: 'Updated:', statusDate: '2025-06-15', chapters: '8/20' }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isComplete).toBe(false);
    expect(result.data.ao3UpdatedAt).toBe('2025-06-15');
  });

  it('fallback: isComplete=true when dt.status absent and availableChapters === totalUnits', async () => {
    // No statusLabel → no stats block → fallback to chapter comparison
    respondWith(makeHtml({ chapters: '5/5' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isComplete).toBe(true);
    expect(result.data.ao3UpdatedAt).toBeNull();
  });

  it('fallback: isComplete=false when dt.status absent and chapters differ', async () => {
    respondWith(makeHtml({ chapters: '3/10' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isComplete).toBe(false);
    expect(result.data.ao3UpdatedAt).toBeNull();
  });

  it('fallback: isComplete=false when dt.status absent and total is unknown (?)', async () => {
    respondWith(makeHtml({ chapters: '3/?' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.isComplete).toBe(false);
    expect(result.data.ao3UpdatedAt).toBeNull();
  });
});

// ── wordCount extraction ──────────────────────────────────────────────────────

describe('wordCount extraction', () => {
  it('extracts word count from dd.words, stripping commas', async () => {
    respondWith(makeHtml({ wordCountStr: '311,105' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.wordCount).toBe(311105);
  });

  it('extracts word count without commas', async () => {
    respondWith(makeHtml({ wordCountStr: '987' }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.wordCount).toBe(987);
  });

  it('returns null wordCount when dd.words is absent', async () => {
    respondWith(makeHtml()); // no stats block emitted
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.wordCount).toBeNull();
  });
});

// ── series extraction ─────────────────────────────────────────────────────────

describe('series extraction', () => {
  it('extracts seriesName, seriesPart, and seriesTotal from a full series block', async () => {
    respondWith(
      makeHtml({
        seriesBlock: 'Part 2 of 7 in <a href="/series/12345">The Untamed Series</a>',
      }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.seriesName).toBe('The Untamed Series');
    expect(result.data.seriesPart).toBe(2);
    expect(result.data.seriesTotal).toBe(7);
  });

  it('sets seriesTotal=null when total is unknown ("?")', async () => {
    respondWith(
      makeHtml({
        seriesBlock: 'Part 3 of ? in <a href="/series/99999">My Series</a>',
      }),
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.seriesPart).toBe(3);
    expect(result.data.seriesTotal).toBeNull();
    expect(result.data.seriesName).toBe('My Series');
  });

  it('returns all null when no series block present', async () => {
    respondWith(makeHtml({ seriesBlock: null }));
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.data.seriesName).toBeNull();
    expect(result.data.seriesPart).toBeNull();
    expect(result.data.seriesTotal).toBeNull();
  });
});

// ── Restricted work detection ─────────────────────────────────────────────────

function respondWithUrl(html: string, finalUrl: string, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    url: finalUrl,
    text: () => Promise.resolve(html),
  });
}

describe('restricted work detection', () => {
  it('returns isRestricted:true when response URL contains /users/login', async () => {
    respondWithUrl(
      '<html><body><form action="/users/login">...</form></body></html>',
      'https://archiveofourown.org/users/login',
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.isRestricted).toBe(true);
    expect(result.data).toEqual({});
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns isRestricted:true when body has login form and no title heading', async () => {
    respondWithUrl(
      '<html><body><form action="/submit">Please login to continue</form></body></html>',
      'https://archiveofourown.org/works/12345?view_adult=true',
    );
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.isRestricted).toBe(true);
    expect(result.data).toEqual({});
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('does not set isRestricted for a normal work page', async () => {
    respondWithUrl(makeHtml(), 'https://archiveofourown.org/works/12345?view_adult=true');
    const result = await fetchAo3Metadata(VALID_WORK_URL);
    expect(result.isRestricted).toBeUndefined();
    expect(result.data.title).toBe('My Test Work');
  });
});
