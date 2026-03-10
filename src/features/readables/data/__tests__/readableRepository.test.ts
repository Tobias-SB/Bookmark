// src/features/readables/data/__tests__/readableRepository.test.ts
// §14 — Integration tests for repository CRUD operations.
// Uses a real in-memory SQLite database via the better-sqlite3 adapter
// (createTestDb.ts). expo-crypto is mocked for deterministic UUIDs.
// expo-sqlite is not mocked — the repository receives the adapter directly.

import * as Crypto from 'expo-crypto';
import { migration001 } from '../../../../app/database/migrations/001_initial';
import {
  createReadable,
  getReadableById,
  listReadables,
  findReadableBySourceId,
  updateReadable,
  deleteReadable,
} from '../readableRepository';
import { createTestDb } from './createTestDb';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

const schema = migration001.sql;

// ── Helpers ───────────────────────────────────────────────────────────────────

let uuidSeq = 0;

function nextUuid(): string {
  return `test-uuid-${++uuidSeq}`;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  uuidSeq = 0;
  (Crypto.randomUUID as jest.Mock).mockImplementation(nextUuid);
  db = createTestDb(schema);
});

// ── createReadable ────────────────────────────────────────────────────────────

describe('createReadable', () => {
  it('returns a readable with the generated id', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'Dune',
      sourceType: 'manual',
    });
    expect(readable.id).toBe('test-uuid-1');
    expect(readable.title).toBe('Dune');
  });

  it('derives progressUnit from kind=book', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'A Book',
      sourceType: 'manual',
    });
    expect(readable.progressUnit).toBe('pages');
  });

  it('derives progressUnit from kind=fanfic', async () => {
    const readable = await createReadable(db as any, {
      kind: 'fanfic',
      title: 'A Fic',
      sourceType: 'ao3',
    });
    expect(readable.progressUnit).toBe('chapters');
  });

  it('defaults status to want_to_read', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'Untitled',
      sourceType: 'manual',
    });
    expect(readable.status).toBe('want_to_read');
  });

  it('persists explicit status', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'Untitled',
      sourceType: 'manual',
      status: 'reading',
    });
    expect(readable.status).toBe('reading');
  });

  it('stores tags as array and reads them back', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'Tagged',
      sourceType: 'manual',
      tags: ['fantasy', 'classic', 'long'],
    });
    expect(readable.tags).toEqual(['fantasy', 'classic', 'long']);
  });

  it('defaults tags to empty array', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'No Tags',
      sourceType: 'manual',
    });
    expect(readable.tags).toEqual([]);
  });

  it('stores isComplete=true and reads it back correctly', async () => {
    const readable = await createReadable(db as any, {
      kind: 'fanfic',
      title: 'Complete Fic',
      sourceType: 'ao3',
      isComplete: true,
    });
    expect(readable.isComplete).toBe(true);
  });

  it('stores isComplete=false and reads it back correctly', async () => {
    const readable = await createReadable(db as any, {
      kind: 'fanfic',
      title: 'WIP Fic',
      sourceType: 'ao3',
      isComplete: false,
    });
    expect(readable.isComplete).toBe(false);
  });

  it('stores isComplete=null for books', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'A Book',
      sourceType: 'manual',
    });
    expect(readable.isComplete).toBeNull();
  });

  it('stores null author, summary, sourceUrl, sourceId', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'Minimal',
      sourceType: 'manual',
    });
    expect(readable.author).toBeNull();
    expect(readable.summary).toBeNull();
    expect(readable.sourceUrl).toBeNull();
    expect(readable.sourceId).toBeNull();
  });

  it('stores provided author and summary', async () => {
    const readable = await createReadable(db as any, {
      kind: 'book',
      title: 'With Author',
      author: 'Jane Austen',
      summary: 'A classic.',
      sourceType: 'manual',
    });
    expect(readable.author).toBe('Jane Austen');
    expect(readable.summary).toBe('A classic.');
  });
});

// ── getReadableById ───────────────────────────────────────────────────────────

describe('getReadableById', () => {
  it('returns null for a non-existent id', async () => {
    const result = await getReadableById(db as any, 'no-such-id');
    expect(result).toBeNull();
  });

  it('returns the readable for an existing id', async () => {
    await createReadable(db as any, {
      kind: 'book',
      title: 'Found',
      sourceType: 'manual',
    });
    const result = await getReadableById(db as any, 'test-uuid-1');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Found');
    expect(result?.id).toBe('test-uuid-1');
  });
});

// ── listReadables ─────────────────────────────────────────────────────────────

describe('listReadables', () => {
  it('returns an empty array for an empty database', async () => {
    const results = await listReadables(db as any);
    expect(results).toEqual([]);
  });

  it('returns all records', async () => {
    await createReadable(db as any, { kind: 'book', title: 'Alpha', sourceType: 'manual' });
    await createReadable(db as any, { kind: 'fanfic', title: 'Beta', sourceType: 'ao3' });
    await createReadable(db as any, { kind: 'book', title: 'Gamma', sourceType: 'manual' });

    const results = await listReadables(db as any);
    expect(results).toHaveLength(3);
    const titles = results.map((r) => r.title).sort();
    expect(titles).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

// ── findReadableBySourceId ────────────────────────────────────────────────────

describe('findReadableBySourceId', () => {
  it('returns null when no match exists', async () => {
    const result = await findReadableBySourceId(db as any, 'work-999', 'ao3');
    expect(result).toBeNull();
  });

  it('finds by sourceId + sourceType=ao3', async () => {
    await createReadable(db as any, {
      kind: 'fanfic',
      title: 'Found Fic',
      sourceType: 'ao3',
      sourceId: 'ao3-work-42',
    });
    const result = await findReadableBySourceId(db as any, 'ao3-work-42', 'ao3');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Found Fic');
    expect(result?.sourceId).toBe('ao3-work-42');
  });

  it('does not match when sourceType differs', async () => {
    await createReadable(db as any, {
      kind: 'book',
      title: 'A Book',
      sourceType: 'book_provider',
      sourceId: 'gbooks-xyz',
    });
    const result = await findReadableBySourceId(db as any, 'gbooks-xyz', 'ao3');
    expect(result).toBeNull();
  });
});

// ── updateReadable ────────────────────────────────────────────────────────────

describe('updateReadable', () => {
  it('throws AppError not_found for a non-existent id', async () => {
    await expect(
      updateReadable(db as any, 'missing-id', { title: 'X' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('updates only the fields provided in input', async () => {
    const original = await createReadable(db as any, {
      kind: 'book',
      title: 'Original Title',
      author: 'Old Author',
      sourceType: 'manual',
    });

    const updated = await updateReadable(db as any, original.id, { title: 'New Title' });

    expect(updated.title).toBe('New Title');
    // author was not in input → preserved
    expect(updated.author).toBe('Old Author');
  });

  it('preserves immutable fields (kind, progressUnit, sourceId)', async () => {
    const original = await createReadable(db as any, {
      kind: 'fanfic',
      title: 'Fic',
      sourceType: 'ao3',
      sourceId: 'ao3-001',
    });

    const updated = await updateReadable(db as any, original.id, { title: 'Updated Fic' });

    expect(updated.kind).toBe('fanfic');
    expect(updated.progressUnit).toBe('chapters');
    expect(updated.sourceId).toBe('ao3-001');
  });

  it('sets nullable fields to null when explicitly passed as null', async () => {
    const original = await createReadable(db as any, {
      kind: 'book',
      title: 'A Book',
      author: 'Some Author',
      summary: 'Some summary',
      sourceType: 'manual',
    });

    const updated = await updateReadable(db as any, original.id, {
      author: null,
      summary: null,
    });

    expect(updated.author).toBeNull();
    expect(updated.summary).toBeNull();
  });

  it('updates tags to a new array', async () => {
    const original = await createReadable(db as any, {
      kind: 'book',
      title: 'Tagged',
      tags: ['old-tag'],
      sourceType: 'manual',
    });

    const updated = await updateReadable(db as any, original.id, {
      tags: ['new-tag-1', 'new-tag-2'],
    });

    expect(updated.tags).toEqual(['new-tag-1', 'new-tag-2']);
  });

  it('updates isComplete and reads it back correctly', async () => {
    const original = await createReadable(db as any, {
      kind: 'fanfic',
      title: 'WIP',
      sourceType: 'ao3',
      isComplete: false,
    });

    const updated = await updateReadable(db as any, original.id, { isComplete: true });
    expect(updated.isComplete).toBe(true);
  });
});

// ── deleteReadable ────────────────────────────────────────────────────────────

describe('deleteReadable', () => {
  it('removes the record from the database', async () => {
    await createReadable(db as any, {
      kind: 'book',
      title: 'To Delete',
      sourceType: 'manual',
    });

    await deleteReadable(db as any, 'test-uuid-1');

    const result = await getReadableById(db as any, 'test-uuid-1');
    expect(result).toBeNull();
  });

  it('does not throw when deleting a non-existent id', async () => {
    await expect(deleteReadable(db as any, 'ghost-id')).resolves.toBeUndefined();
  });

  it('only removes the targeted record', async () => {
    await createReadable(db as any, { kind: 'book', title: 'Keep', sourceType: 'manual' });
    await createReadable(db as any, { kind: 'book', title: 'Delete Me', sourceType: 'manual' });

    await deleteReadable(db as any, 'test-uuid-2');

    const remaining = await listReadables(db as any);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Keep');
  });
});
