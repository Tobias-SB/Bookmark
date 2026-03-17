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
  summary = 'A test summary.',
  chapters = '3/5',
  fandomTags = ['My Fandom'],
  relTags = ['A/B'],
  charTags = ['Char A'],
  freeformTags = ['Tag One', 'Tag Two'],
}: {
  title?: string;
  author?: string | null;
  summary?: string | null;
  chapters?: string;
  fandomTags?: string[];
  relTags?: string[];
  charTags?: string[];
  freeformTags?: string[];
} = {}): string {
  const authorHtml =
    author !== null
      ? `<a rel="author" href="/users/TestAuthor/pseuds/TestAuthor">${author}</a>`
      : '';

  const summaryHtml =
    summary !== null
      ? `<div class="summary module"><h3 class="heading">Summary:</h3><blockquote class="userstuff"><p>${summary}</p></blockquote></div>`
      : '';

  const tagsHtml = (ddClass: string, tags: string[]) =>
    tags.length > 0
      ? `<dd class="${ddClass}"><ul class="commas">${tags.map((t) => `<li><a class="tag" href="#">${t}</a></li>`).join('')}</ul></dd>`
      : '';

  return `
    <html>
    <body>
      <h2 class="title heading">${title}</h2>
      <h3 class="byline heading">by ${authorHtml}</h3>
      ${summaryHtml}
      <dl class="work meta group">
        <dd class="chapters">${chapters}</dd>
        ${tagsHtml('fandom tags', fandomTags)}
        ${tagsHtml('relationship tags', relTags)}
        ${tagsHtml('character tags', charTags)}
        ${tagsHtml('freeform tags', freeformTags)}
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

  it('extracts author', async () => {
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

  it('collects tags from all categories into a flat array', async () => {
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
      makeHtml({ fandomTags: [], relTags: [], charTags: [], freeformTags: [] }),
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
