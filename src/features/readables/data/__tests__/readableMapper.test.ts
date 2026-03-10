// src/features/readables/data/__tests__/readableMapper.test.ts
// §14 — Unit tests for parseTags, booleanFromSQLite, booleanToSQLite, rowToReadable.
// All functions are pure (no I/O) — no mocking required.

import {
  parseTags,
  booleanFromSQLite,
  booleanToSQLite,
  rowToReadable,
  type ReadableRow,
} from '../readableMapper';

// ── parseTags ─────────────────────────────────────────────────────────────────

describe('parseTags', () => {
  it('returns [] for null', () => {
    expect(parseTags(null)).toEqual([]);
  });

  it('returns [] for empty string (JSON.parse("") throws)', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    expect(parseTags('not-json')).toEqual([]);
    expect(parseTags('{broken')).toEqual([]);
  });

  it('returns [] for serialised empty array', () => {
    expect(parseTags('[]')).toEqual([]);
  });

  it('returns the array for a valid JSON tag array', () => {
    expect(parseTags('["sci-fi","mystery","thriller"]')).toEqual([
      'sci-fi',
      'mystery',
      'thriller',
    ]);
  });

  it('returns a single-element array', () => {
    expect(parseTags('["romance"]')).toEqual(['romance']);
  });
});

// ── booleanFromSQLite ─────────────────────────────────────────────────────────

describe('booleanFromSQLite', () => {
  it('maps 0 → false', () => {
    expect(booleanFromSQLite(0)).toBe(false);
  });

  it('maps 1 → true', () => {
    expect(booleanFromSQLite(1)).toBe(true);
  });

  it('maps null → null', () => {
    expect(booleanFromSQLite(null)).toBeNull();
  });

  it('maps any non-zero integer → true', () => {
    expect(booleanFromSQLite(2)).toBe(true);
    expect(booleanFromSQLite(-1)).toBe(true);
  });
});

// ── booleanToSQLite ───────────────────────────────────────────────────────────

describe('booleanToSQLite', () => {
  it('maps true → 1', () => {
    expect(booleanToSQLite(true)).toBe(1);
  });

  it('maps false → 0', () => {
    expect(booleanToSQLite(false)).toBe(0);
  });

  it('maps null → null', () => {
    expect(booleanToSQLite(null)).toBeNull();
  });
});

// ── rowToReadable ─────────────────────────────────────────────────────────────

describe('rowToReadable', () => {
  const baseRow: ReadableRow = {
    id: 'row-id-1',
    kind: 'book',
    title: 'Test Book',
    author: 'Test Author',
    status: 'reading',
    progress_current: 50,
    progress_total: 300,
    progress_unit: 'pages',
    source_type: 'manual',
    source_url: null,
    source_id: null,
    summary: 'A good read.',
    tags: '["fiction","mystery"]',
    is_complete: null,
    date_added: '2025-01-15T00:00:00.000Z',
    date_created: '2025-01-01T00:00:00.000Z',
    date_updated: '2025-01-16T00:00:00.000Z',
  };

  it('maps all camelCase fields from snake_case row columns', () => {
    const readable = rowToReadable(baseRow);

    expect(readable.id).toBe('row-id-1');
    expect(readable.kind).toBe('book');
    expect(readable.title).toBe('Test Book');
    expect(readable.author).toBe('Test Author');
    expect(readable.status).toBe('reading');
    expect(readable.progressCurrent).toBe(50);
    expect(readable.progressTotal).toBe(300);
    expect(readable.progressUnit).toBe('pages');
    expect(readable.sourceType).toBe('manual');
    expect(readable.sourceUrl).toBeNull();
    expect(readable.sourceId).toBeNull();
    expect(readable.summary).toBe('A good read.');
    expect(readable.tags).toEqual(['fiction', 'mystery']);
    expect(readable.isComplete).toBeNull();
    expect(readable.dateAdded).toBe('2025-01-15T00:00:00.000Z');
    expect(readable.dateCreated).toBe('2025-01-01T00:00:00.000Z');
    expect(readable.dateUpdated).toBe('2025-01-16T00:00:00.000Z');
  });

  it('deserialises tags from JSON string', () => {
    const readable = rowToReadable({ ...baseRow, tags: '["fantasy","romance","slow burn"]' });
    expect(readable.tags).toEqual(['fantasy', 'romance', 'slow burn']);
  });

  it('returns [] for malformed tags without throwing', () => {
    const readable = rowToReadable({ ...baseRow, tags: 'INVALID' });
    expect(readable.tags).toEqual([]);
  });

  it('converts is_complete=1 → isComplete=true', () => {
    const readable = rowToReadable({ ...baseRow, is_complete: 1 });
    expect(readable.isComplete).toBe(true);
  });

  it('converts is_complete=0 → isComplete=false', () => {
    const readable = rowToReadable({ ...baseRow, is_complete: 0 });
    expect(readable.isComplete).toBe(false);
  });

  it('converts is_complete=null → isComplete=null', () => {
    const readable = rowToReadable({ ...baseRow, is_complete: null });
    expect(readable.isComplete).toBeNull();
  });

  it('preserves null author, summary, sourceUrl, sourceId', () => {
    const readable = rowToReadable({
      ...baseRow,
      author: null,
      summary: null,
      source_url: null,
      source_id: null,
    });
    expect(readable.author).toBeNull();
    expect(readable.summary).toBeNull();
    expect(readable.sourceUrl).toBeNull();
    expect(readable.sourceId).toBeNull();
  });

  it('maps fanfic row with chapters progress unit', () => {
    const readable = rowToReadable({
      ...baseRow,
      kind: 'fanfic',
      progress_unit: 'chapters',
      progress_current: 8,
      progress_total: 12,
      is_complete: 0,
    });
    expect(readable.kind).toBe('fanfic');
    expect(readable.progressUnit).toBe('chapters');
    expect(readable.progressCurrent).toBe(8);
    expect(readable.progressTotal).toBe(12);
    expect(readable.isComplete).toBe(false);
  });
});
