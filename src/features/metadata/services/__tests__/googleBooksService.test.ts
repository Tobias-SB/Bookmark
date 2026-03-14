// src/features/metadata/services/__tests__/googleBooksService.test.ts
// §14 — Unit tests for searchGoogleBooks response mapping.
// fetch and expo-constants are mocked — no real network requests or API keys.

import { searchGoogleBooks } from '../googleBooksService';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// jest-expo runs as iOS by default, so the service reads googleBooksApiKeyIos.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { googleBooksApiKeyIos: 'test-api-key' },
    },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function respondWith(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function makeVolume(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vol-abc123',
    volumeInfo: {
      title: 'The Great Gatsby',
      authors: ['F. Scott Fitzgerald'],
      description: 'A novel about the American Dream.',
      categories: ['Fiction', 'Classic'],
      pageCount: 180,
      infoLink: 'https://books.google.com/books?id=vol-abc123',
      ...overrides,
    },
  };
}

// ── Guard conditions ──────────────────────────────────────────────────────────

describe('guard conditions', () => {
  it('returns error immediately for empty query without fetching', async () => {
    const result = await searchGoogleBooks('');
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/empty/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error immediately for whitespace-only query', async () => {
    const result = await searchGoogleBooks('   ');
    expect(result.data).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Network and API errors ────────────────────────────────────────────────────

describe('network and API errors', () => {
  it('returns error on network failure without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await searchGoogleBooks('gatsby');
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/fetch/i);
  });

  it('returns error for non-OK HTTP status', async () => {
    respondWith({}, 403);
    const result = await searchGoogleBooks('gatsby');
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/403/);
  });

  it('returns error when API returns no items', async () => {
    respondWith({ totalItems: 0, items: [] });
    const result = await searchGoogleBooks('xyzxyzxyz');
    expect(result.data).toEqual({});
    expect(result.errors[0]).toMatch(/no results/i);
  });

  it('returns error when items is absent from response', async () => {
    respondWith({ totalItems: 0 });
    const result = await searchGoogleBooks('something');
    expect(result.data).toEqual({});
    expect(result.errors).toHaveLength(1);
  });
});

// ── Successful field mapping ──────────────────────────────────────────────────

describe('successful field mapping', () => {
  it('maps title from volumeInfo.title', async () => {
    respondWith({ items: [makeVolume()] });
    const result = await searchGoogleBooks('gatsby');
    expect(result.data.title).toBe('The Great Gatsby');
  });

  it('maps first author from authors array', async () => {
    respondWith({ items: [makeVolume({ authors: ['Author One', 'Author Two'] })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.author).toBe('Author One');
  });

  it('sets author to null when authors array is absent', async () => {
    respondWith({ items: [makeVolume({ authors: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.author).toBeNull();
  });

  it('sets author to null when authors array is empty', async () => {
    respondWith({ items: [makeVolume({ authors: [] })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.author).toBeNull();
  });

  it('maps description to summary', async () => {
    respondWith({ items: [makeVolume({ description: 'A compelling story.' })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.summary).toBe('A compelling story.');
  });

  it('sets summary to null when description is absent', async () => {
    respondWith({ items: [makeVolume({ description: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.summary).toBeNull();
  });

  it('maps categories to tags array', async () => {
    respondWith({
      items: [makeVolume({ categories: ['Science Fiction', 'Adventure'] })],
    });
    const result = await searchGoogleBooks('query');
    expect(result.data.tags).toEqual(['Science Fiction', 'Adventure']);
  });

  it('returns empty tags when categories is absent', async () => {
    respondWith({ items: [makeVolume({ categories: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.tags).toEqual([]);
  });

  it('maps pageCount to progressTotal', async () => {
    respondWith({ items: [makeVolume({ pageCount: 350 })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.progressTotal).toBe(350);
  });

  it('sets progressTotal to null for pageCount=0', async () => {
    respondWith({ items: [makeVolume({ pageCount: 0 })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.progressTotal).toBeNull();
  });

  it('sets progressTotal to null when pageCount is absent', async () => {
    respondWith({ items: [makeVolume({ pageCount: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.progressTotal).toBeNull();
  });

  it('always sets progressCurrent to null', async () => {
    respondWith({ items: [makeVolume()] });
    const result = await searchGoogleBooks('query');
    expect(result.data.progressCurrent).toBeNull();
  });

  it('always sets isComplete to null (books are not AO3 works)', async () => {
    respondWith({ items: [makeVolume()] });
    const result = await searchGoogleBooks('query');
    expect(result.data.isComplete).toBeNull();
  });

  it('maps infoLink to sourceUrl', async () => {
    respondWith({
      items: [makeVolume({ infoLink: 'https://books.google.com/books?id=xyz' })],
    });
    const result = await searchGoogleBooks('query');
    expect(result.data.sourceUrl).toBe('https://books.google.com/books?id=xyz');
  });

  it('sets sourceUrl to null when infoLink is absent', async () => {
    respondWith({ items: [makeVolume({ infoLink: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.sourceUrl).toBeNull();
  });

  it('maps volume id to sourceId', async () => {
    respondWith({ items: [{ id: 'BOOK_VOL_ID', volumeInfo: makeVolume().volumeInfo }] });
    const result = await searchGoogleBooks('query');
    expect(result.data.sourceId).toBe('BOOK_VOL_ID');
  });

  it('sets sourceId to null when volume id is absent', async () => {
    respondWith({ items: [{ volumeInfo: makeVolume().volumeInfo }] });
    const result = await searchGoogleBooks('query');
    expect(result.data.sourceId).toBeNull();
  });

  it('returns no errors for a fully populated result', async () => {
    respondWith({ items: [makeVolume()] });
    const result = await searchGoogleBooks('gatsby');
    expect(result.errors).toHaveLength(0);
  });

  it('appends an error when title is absent but still maps other fields', async () => {
    respondWith({ items: [makeVolume({ title: undefined })] });
    const result = await searchGoogleBooks('query');
    expect(result.data.title).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
    // Other fields should still map
    expect(result.data.progressTotal).toBe(180);
  });

  it('includes the API key in the fetch URL', async () => {
    respondWith({ items: [makeVolume()] });
    await searchGoogleBooks('dune');
    // fetch is called as fetch(url, { headers }) — match both args
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('key=test-api-key'),
      expect.anything(),
    );
  });

  it('URL-encodes the search query', async () => {
    respondWith({ items: [makeVolume()] });
    await searchGoogleBooks('lord of the rings');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('lord%20of%20the%20rings'),
      expect.anything(),
    );
  });
});
