// src/features/shelves/data/__tests__/shelfRepository.test.ts
// Integration tests for shelfRepository using the better-sqlite3 in-memory adapter.
// expo-crypto is mocked for deterministic UUIDs.

import * as Crypto from 'expo-crypto';
import { migration001 } from '../../../../app/database/migrations/001_initial';
import {
  createShelf,
  getShelfById,
  listShelves,
  updateShelf,
  deleteShelf,
  addToShelf,
  removeFromShelf,
  listShelfReadables,
  reorderShelf,
} from '../shelfRepository';
import { createTestDb } from '../../../readables/data/__tests__/createTestDb';

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

/**
 * Inserts a minimal readable row directly so that shelf_readables foreign key
 * constraints are satisfied when testing addToShelf.
 */
async function insertMinimalReadable(id: string): Promise<void> {
  const now = new Date().toISOString();
  await (db as any).runAsync(
    `INSERT INTO readables (id, kind, title, status, progress_unit, source_type,
      tags, fandom, relationships, archive_warnings, is_abandoned,
      date_added, date_created, date_updated)
     VALUES (?, 'book', 'Test Readable', 'want_to_read', 'pages', 'manual',
       '[]', '[]', '[]', '[]', 0, ?, ?, ?)`,
    [id, now, now, now],
  );
}

// ── createShelf ───────────────────────────────────────────────────────────────

describe('createShelf', () => {
  it('returns a shelf with the generated id and trimmed name', async () => {
    const shelf = await createShelf(db as any, { name: '  Favourites  ' });
    expect(shelf.id).toBe('test-uuid-1');
    expect(shelf.name).toBe('Favourites');
  });

  it('sets sort_order to 0 for the first shelf', async () => {
    const shelf = await createShelf(db as any, { name: 'A' });
    expect(shelf.sortOrder).toBe(0);
  });

  it('sets dateCreated and dateUpdated to ISO strings', async () => {
    const shelf = await createShelf(db as any, { name: 'A' });
    expect(shelf.dateCreated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(shelf.dateUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── getShelfById ──────────────────────────────────────────────────────────────

describe('getShelfById', () => {
  it('returns the shelf when found', async () => {
    const created = await createShelf(db as any, { name: 'Reading' });
    const found = await getShelfById(db as any, created.id);
    expect(found?.name).toBe('Reading');
  });

  it('returns null for an unknown id', async () => {
    const result = await getShelfById(db as any, 'does-not-exist');
    expect(result).toBeNull();
  });
});

// ── listShelves ───────────────────────────────────────────────────────────────

describe('listShelves', () => {
  it('returns empty array when no shelves exist', async () => {
    const shelves = await listShelves(db as any);
    expect(shelves).toEqual([]);
  });

  it('returns all shelves ordered by sort_order ASC', async () => {
    const a = await createShelf(db as any, { name: 'A' });
    const b = await createShelf(db as any, { name: 'B' });
    // Update sort_order so we can verify ordering
    await updateShelf(db as any, b.id, { sortOrder: 0 });
    await updateShelf(db as any, a.id, { sortOrder: 1 });
    const shelves = await listShelves(db as any);
    expect(shelves[0].name).toBe('B');
    expect(shelves[1].name).toBe('A');
  });
});

// ── updateShelf ───────────────────────────────────────────────────────────────

describe('updateShelf', () => {
  it('updates the name', async () => {
    const shelf = await createShelf(db as any, { name: 'Old' });
    const updated = await updateShelf(db as any, shelf.id, { name: 'New' });
    expect(updated.name).toBe('New');
  });

  it('trims the updated name', async () => {
    const shelf = await createShelf(db as any, { name: 'Old' });
    const updated = await updateShelf(db as any, shelf.id, { name: '  New  ' });
    expect(updated.name).toBe('New');
  });

  it('throws not_found for an unknown id', async () => {
    await expect(
      updateShelf(db as any, 'does-not-exist', { name: 'X' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('preserves name when not in input', async () => {
    const shelf = await createShelf(db as any, { name: 'Original' });
    const updated = await updateShelf(db as any, shelf.id, { sortOrder: 5 });
    expect(updated.name).toBe('Original');
    expect(updated.sortOrder).toBe(5);
  });
});

// ── deleteShelf ───────────────────────────────────────────────────────────────

describe('deleteShelf', () => {
  it('removes the shelf so getShelfById returns null', async () => {
    const shelf = await createShelf(db as any, { name: 'TempShelf' });
    await deleteShelf(db as any, shelf.id);
    const found = await getShelfById(db as any, shelf.id);
    expect(found).toBeNull();
  });
});

// ── addToShelf / removeFromShelf / listShelfReadables ─────────────────────────

describe('addToShelf', () => {
  it('adds a readable to the shelf with position 0 when empty', async () => {
    await insertMinimalReadable('readable-1');
    const shelf = await createShelf(db as any, { name: 'S' });
    await addToShelf(db as any, shelf.id, 'readable-1');
    const items = await listShelfReadables(db as any, shelf.id);
    expect(items).toHaveLength(1);
    expect(items[0].readableId).toBe('readable-1');
    expect(items[0].position).toBe(0);
  });

  it('increments position for subsequent additions', async () => {
    await insertMinimalReadable('readable-1');
    await insertMinimalReadable('readable-2');
    const shelf = await createShelf(db as any, { name: 'S' });
    await addToShelf(db as any, shelf.id, 'readable-1');
    await addToShelf(db as any, shelf.id, 'readable-2');
    const items = await listShelfReadables(db as any, shelf.id);
    expect(items).toHaveLength(2);
    expect(items[0].position).toBe(0);
    expect(items[1].position).toBe(1);
  });

  it('is idempotent — adding the same readable twice does not create a duplicate', async () => {
    await insertMinimalReadable('readable-1');
    const shelf = await createShelf(db as any, { name: 'S' });
    await addToShelf(db as any, shelf.id, 'readable-1');
    await addToShelf(db as any, shelf.id, 'readable-1'); // second call — no-op
    const items = await listShelfReadables(db as any, shelf.id);
    expect(items).toHaveLength(1);
  });
});

describe('removeFromShelf', () => {
  it('removes the readable from the shelf', async () => {
    await insertMinimalReadable('readable-1');
    const shelf = await createShelf(db as any, { name: 'S' });
    await addToShelf(db as any, shelf.id, 'readable-1');
    await removeFromShelf(db as any, shelf.id, 'readable-1');
    const items = await listShelfReadables(db as any, shelf.id);
    expect(items).toHaveLength(0);
  });

  it('does not throw when the readable is not a member', async () => {
    const shelf = await createShelf(db as any, { name: 'S' });
    await expect(
      removeFromShelf(db as any, shelf.id, 'not-a-member'),
    ).resolves.toBeUndefined();
  });
});

// ── reorderShelf ──────────────────────────────────────────────────────────────

describe('reorderShelf', () => {
  it('updates positions in a single transaction', async () => {
    await insertMinimalReadable('r1');
    await insertMinimalReadable('r2');
    await insertMinimalReadable('r3');
    const shelf = await createShelf(db as any, { name: 'S' });
    await addToShelf(db as any, shelf.id, 'r1');
    await addToShelf(db as any, shelf.id, 'r2');
    await addToShelf(db as any, shelf.id, 'r3');

    // Reverse the order
    await reorderShelf(db as any, shelf.id, ['r3', 'r2', 'r1']);

    const items = await listShelfReadables(db as any, shelf.id);
    expect(items[0].readableId).toBe('r3');
    expect(items[1].readableId).toBe('r2');
    expect(items[2].readableId).toBe('r1');
  });

  it('handles an empty orderedIds array without error', async () => {
    const shelf = await createShelf(db as any, { name: 'S' });
    await expect(reorderShelf(db as any, shelf.id, [])).resolves.toBeUndefined();
  });
});
