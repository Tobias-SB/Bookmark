// src/features/wipUpdates/data/__tests__/wipUpdateRepository.test.ts
// Integration tests for wipUpdateRepository using the better-sqlite3 in-memory adapter.
// expo-crypto is mocked for deterministic UUIDs.

import * as Crypto from 'expo-crypto';
import { migration001 } from '../../../../app/database/migrations/001_initial';
import {
  createWipUpdate,
  getWipUpdateById,
  listWipUpdates,
  listUnreadWipUpdates,
  markWipUpdateRead,
  markAllWipUpdatesRead,
  deleteWipUpdate,
  deleteReadWipUpdates,
  deleteAllWipUpdates,
} from '../wipUpdateRepository';
import { createTestDb } from '../../../readables/data/__tests__/createTestDb';
import type { CreateWipUpdateInput } from '../../domain/wipUpdate';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

const schema = migration001.sql;

// ── Helpers ───────────────────────────────────────────────────────────────────

let uuidSeq = 0;

function nextUuid(): string {
  return `test-uuid-${++uuidSeq}`;
}

function makeInput(overrides: Partial<CreateWipUpdateInput> = {}): CreateWipUpdateInput {
  return {
    readableId: 'readable-1',
    readableTitle: 'My Fic',
    readableAuthor: 'Author One',
    checkedAt: new Date().toISOString(),
    previousAvailableChapters: 10,
    fetchedAvailableChapters: 12,
    previousTotalUnits: null,
    fetchedTotalUnits: null,
    previousWordCount: 50000,
    fetchedWordCount: 60000,
    previousIsComplete: false,
    fetchedIsComplete: false,
    previousTags: ['fluff', 'angst'],
    fetchedTags: ['fluff', 'angst', 'hurt/comfort'],
    previousRelationships: ['A/B'],
    fetchedRelationships: ['A/B'],
    previousArchiveWarnings: [],
    fetchedArchiveWarnings: [],
    previousSeriesTotal: null,
    fetchedSeriesTotal: null,
    statusReverted: false,
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  uuidSeq = 0;
  (Crypto.randomUUID as jest.Mock).mockImplementation(nextUuid);
  db = createTestDb(schema);
});

// ── createWipUpdate ───────────────────────────────────────────────────────────

describe('createWipUpdate', () => {
  it('returns a record with status=unread and the generated id', async () => {
    const record = await createWipUpdate(db as any, makeInput());
    expect(record.id).toBe('test-uuid-1');
    expect(record.status).toBe('unread');
  });

  it('maps boolean fields correctly (previousIsComplete, fetchedIsComplete)', async () => {
    const record = await createWipUpdate(
      db as any,
      makeInput({ previousIsComplete: true, fetchedIsComplete: false }),
    );
    expect(record.previousIsComplete).toBe(true);
    expect(record.fetchedIsComplete).toBe(false);
  });

  it('maps null boolean fields to null', async () => {
    const record = await createWipUpdate(
      db as any,
      makeInput({ previousIsComplete: null, fetchedIsComplete: null }),
    );
    expect(record.previousIsComplete).toBeNull();
    expect(record.fetchedIsComplete).toBeNull();
  });

  it('round-trips JSON array fields', async () => {
    const record = await createWipUpdate(
      db as any,
      makeInput({
        previousTags: ['tag-a', 'tag-b'],
        fetchedTags: ['tag-a', 'tag-b', 'tag-c'],
      }),
    );
    expect(record.previousTags).toEqual(['tag-a', 'tag-b']);
    expect(record.fetchedTags).toEqual(['tag-a', 'tag-b', 'tag-c']);
  });

  it('maps statusReverted=true correctly', async () => {
    const record = await createWipUpdate(db as any, makeInput({ statusReverted: true }));
    expect(record.statusReverted).toBe(true);
  });
});

// ── getWipUpdateById ──────────────────────────────────────────────────────────

describe('getWipUpdateById', () => {
  it('returns the record when found', async () => {
    const created = await createWipUpdate(db as any, makeInput());
    const found = await getWipUpdateById(db as any, created.id);
    expect(found?.readableTitle).toBe('My Fic');
  });

  it('returns null for an unknown id', async () => {
    const result = await getWipUpdateById(db as any, 'no-such-id');
    expect(result).toBeNull();
  });
});

// ── listWipUpdates / listUnreadWipUpdates ─────────────────────────────────────

describe('listWipUpdates', () => {
  it('returns empty array when no records exist', async () => {
    const records = await listWipUpdates(db as any);
    expect(records).toHaveLength(0);
  });

  it('lists all records (unread first)', async () => {
    const r1 = await createWipUpdate(db as any, makeInput({ readableTitle: 'Fic A' }));
    await createWipUpdate(db as any, makeInput({ readableTitle: 'Fic B' }));
    // Mark r1 as read — it should appear after the unread one
    await markWipUpdateRead(db as any, r1.id);

    const records = await listWipUpdates(db as any);
    expect(records).toHaveLength(2);
    // First record should be unread (Fic B)
    expect(records[0].status).toBe('unread');
    expect(records[0].readableTitle).toBe('Fic B');
    // Second record should be read (Fic A)
    expect(records[1].status).toBe('read');
    expect(records[1].readableTitle).toBe('Fic A');
  });
});

describe('listUnreadWipUpdates', () => {
  it('returns only unread records', async () => {
    const r1 = await createWipUpdate(db as any, makeInput({ readableTitle: 'Fic A' }));
    await createWipUpdate(db as any, makeInput({ readableTitle: 'Fic B' }));
    await markWipUpdateRead(db as any, r1.id);

    const unread = await listUnreadWipUpdates(db as any);
    expect(unread).toHaveLength(1);
    expect(unread[0].readableTitle).toBe('Fic B');
  });
});

// ── markWipUpdateRead / markAllWipUpdatesRead ─────────────────────────────────

describe('markWipUpdateRead', () => {
  it('changes status from unread to read', async () => {
    const record = await createWipUpdate(db as any, makeInput());
    expect(record.status).toBe('unread');
    await markWipUpdateRead(db as any, record.id);
    const updated = await getWipUpdateById(db as any, record.id);
    expect(updated?.status).toBe('read');
  });
});

describe('markAllWipUpdatesRead', () => {
  it('marks every unread record as read', async () => {
    await createWipUpdate(db as any, makeInput({ readableTitle: 'A' }));
    await createWipUpdate(db as any, makeInput({ readableTitle: 'B' }));
    await createWipUpdate(db as any, makeInput({ readableTitle: 'C' }));
    await markAllWipUpdatesRead(db as any);
    const unread = await listUnreadWipUpdates(db as any);
    expect(unread).toHaveLength(0);
  });
});

// ── deleteWipUpdate / deleteReadWipUpdates / deleteAllWipUpdates ──────────────

describe('deleteWipUpdate', () => {
  it('removes the record so getWipUpdateById returns null', async () => {
    const record = await createWipUpdate(db as any, makeInput());
    await deleteWipUpdate(db as any, record.id);
    const found = await getWipUpdateById(db as any, record.id);
    expect(found).toBeNull();
  });
});

describe('deleteReadWipUpdates', () => {
  it('deletes only read records, leaving unread ones intact', async () => {
    const r1 = await createWipUpdate(db as any, makeInput({ readableTitle: 'Unread' }));
    const r2 = await createWipUpdate(db as any, makeInput({ readableTitle: 'Read' }));
    await markWipUpdateRead(db as any, r2.id);

    await deleteReadWipUpdates(db as any);

    const all = await listWipUpdates(db as any);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(r1.id);
  });
});

describe('deleteAllWipUpdates', () => {
  it('removes all records', async () => {
    await createWipUpdate(db as any, makeInput());
    await createWipUpdate(db as any, makeInput());
    await deleteAllWipUpdates(db as any);
    const all = await listWipUpdates(db as any);
    expect(all).toHaveLength(0);
  });
});
