// src/features/readables/hooks/__tests__/useUpdateReadable.test.ts
// §14 — Unit tests for §4 status/progress consistency rules.
// Tests applyCreateConsistency and applyUpdateConsistency as pure functions —
// no React context, no TanStack Query, no database required.
//
// The functions are exported specifically to enable isolated unit testing.
//
// expo-sqlite and its DatabaseProvider wrapper are mocked with empty factories
// so Jest does not attempt to load the native module or its expo-asset
// dependency (which is not installed in the test environment).

// These mocks must appear before any imports that transitively require them.
// Babel hoists jest.mock calls to the top automatically.
jest.mock('expo-sqlite', () => ({}));
jest.mock('../../../../app/database/DatabaseProvider', () => ({
  useDatabase: jest.fn(),
  useDatabaseContext: jest.fn(),
}));

import { applyCreateConsistency } from '../useCreateReadable';
import { applyUpdateConsistency } from '../useUpdateReadable';
import type { Readable } from '../../domain/readable';
import type { CreateReadableInput } from '../../data/readableRepository';

// ── Test fixture helpers ──────────────────────────────────────────────────────

function makeReadable(overrides: Partial<Readable> = {}): Readable {
  return {
    id: 'r1',
    kind: 'book',
    title: 'Test',
    author: null,
    status: 'want_to_read',
    progressCurrent: null,
    totalUnits: null,
    progressUnit: 'pages',
    sourceType: 'manual',
    sourceUrl: null,
    sourceId: null,
    summary: null,
    tags: [],
    isComplete: null,
    isbn: null,
    coverUrl: null,
    availableChapters: null,
    wordCount: null,
    fandom: [],
    relationships: [],
    rating: null,
    archiveWarnings: [],
    isAbandoned: false,
    authorType: null,
    publishedAt: null,
    ao3UpdatedAt: null,
    seriesName: null,
    seriesPart: null,
    seriesTotal: null,
    notes: null,
    notesUpdatedAt: null,
    dateAdded: '2025-01-01T00:00:00.000Z',
    dateCreated: '2025-01-01T00:00:00.000Z',
    dateUpdated: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateReadableInput> = {}): CreateReadableInput {
  return {
    kind: 'book',
    title: 'Test',
    sourceType: 'manual',
    ...overrides,
  };
}

// ── applyUpdateConsistency ────────────────────────────────────────────────────

describe('applyUpdateConsistency', () => {
  // Rule 1: progress entered on want_to_read → reading
  describe('Rule 1: progress entered on want_to_read', () => {
    it('auto-changes status to reading when progressCurrent is entered', () => {
      const current = makeReadable({ status: 'want_to_read' });
      const result = applyUpdateConsistency({ progressCurrent: 10 }, current);
      expect(result.status).toBe('reading');
    });

    it('does NOT fire when progressCurrent is present but null', () => {
      const current = makeReadable({ status: 'want_to_read' });
      const result = applyUpdateConsistency({ progressCurrent: null }, current);
      // progressCurrent key is in input, but value is null → rule 1 does not fire
      // Rule 5 fires instead: want_to_read → clear progressCurrent
      expect(result.status).toBe('want_to_read');
    });

    it('does NOT fire when status is not want_to_read', () => {
      const current = makeReadable({ status: 'dnf', progressCurrent: 5 });
      const result = applyUpdateConsistency({ progressCurrent: 20 }, current);
      expect(result.status).toBe('dnf');
    });

    it('does NOT fire when progressCurrent key is not in input', () => {
      const current = makeReadable({ status: 'want_to_read' });
      const result = applyUpdateConsistency({ status: 'want_to_read' }, current);
      expect(result.status).toBe('want_to_read');
    });
  });

  // Rule 2: progressCurrent explicitly set and reaches threshold → completed
  describe('Rule 2: progressCurrent reaches completion threshold', () => {
    describe('book — threshold is totalUnits', () => {
      it('auto-changes status to completed when current equals total', () => {
        const current = makeReadable({ status: 'reading', totalUnits: 300 });
        const result = applyUpdateConsistency({ progressCurrent: 300 }, current);
        expect(result.status).toBe('completed');
      });

      it('auto-changes status to completed when current exceeds total', () => {
        const current = makeReadable({ status: 'reading', totalUnits: 300 });
        const result = applyUpdateConsistency({ progressCurrent: 305 }, current);
        expect(result.status).toBe('completed');
      });

      it('does NOT fire when current is less than total', () => {
        const current = makeReadable({ status: 'reading', totalUnits: 300 });
        const result = applyUpdateConsistency({ progressCurrent: 150 }, current);
        expect(result.status).toBe('reading');
      });

      it('does NOT fire when total is unknown (null)', () => {
        const current = makeReadable({ status: 'reading', totalUnits: null });
        const result = applyUpdateConsistency({ progressCurrent: 100 }, current);
        expect(result.status).toBe('reading');
      });

      it('does NOT fire when progressCurrent is not in input (prevents re-completion loop)', () => {
        // User changes status from completed → reading. progressCurrent is still at
        // the threshold in current, but Rule 2 must not re-evaluate inherited progress.
        const current = makeReadable({
          status: 'completed',
          progressCurrent: 300,
          totalUnits: 300,
        });
        const result = applyUpdateConsistency({ status: 'reading' }, current);
        expect(result.status).toBe('reading');
      });
    });

    describe('fanfic — threshold is availableChapters (not totalUnits)', () => {
      it('auto-completes when progressCurrent reaches availableChapters', () => {
        const current = makeReadable({
          kind: 'fanfic',
          status: 'reading',
          availableChapters: 10,
          totalUnits: 20,
        });
        const result = applyUpdateConsistency({ progressCurrent: 10 }, current);
        expect(result.status).toBe('completed');
        expect(result.progressCurrent).toBe(10);
      });

      it('does NOT auto-complete when progressCurrent is below availableChapters', () => {
        const current = makeReadable({
          kind: 'fanfic',
          status: 'reading',
          availableChapters: 10,
          totalUnits: 10,
        });
        const result = applyUpdateConsistency({ progressCurrent: 7 }, current);
        expect(result.status).toBe('reading');
      });

      it('falls back to totalUnits when availableChapters is null', () => {
        const current = makeReadable({
          kind: 'fanfic',
          status: 'reading',
          availableChapters: null,
          totalUnits: 12,
        });
        const result = applyUpdateConsistency({ progressCurrent: 12 }, current);
        expect(result.status).toBe('completed');
      });
    });
  });

  // Rule 3: progressCurrent pinned to threshold on auto-completion or explicit completed
  describe('Rule 3: progressCurrent pinned to threshold', () => {
    it('pins progressCurrent to totalUnits when Rule 2 fires', () => {
      const current = makeReadable({ status: 'reading', totalUnits: 12 });
      const result = applyUpdateConsistency({ progressCurrent: 12 }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(12);
    });

    it('pins progressCurrent to totalUnits when status is explicitly set to completed', () => {
      const current = makeReadable({
        status: 'reading',
        progressCurrent: 200,
        totalUnits: 420,
      });
      const result = applyUpdateConsistency({ status: 'completed' }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(420);
    });

    it('pins to availableChapters (not totalUnits) for fanfic auto-completion', () => {
      const current = makeReadable({
        kind: 'fanfic',
        status: 'reading',
        availableChapters: 10,
        totalUnits: 20,
      });
      const result = applyUpdateConsistency({ progressCurrent: 10 }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(10);
    });

    it('pins to availableChapters when status explicitly set to completed on a fanfic', () => {
      const current = makeReadable({
        kind: 'fanfic',
        status: 'reading',
        progressCurrent: 5,
        availableChapters: 10,
        totalUnits: 20,
      });
      const result = applyUpdateConsistency({ status: 'completed' }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(10);
    });

    it('does NOT fire when total/threshold is unknown', () => {
      const current = makeReadable({ status: 'reading', totalUnits: null });
      const result = applyUpdateConsistency({ status: 'completed' }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(null);
    });
  });

  // Revert rule: lowering progress on a completed readable reverts to reading
  describe('Revert rule: lowering progress on completed readable reverts to reading', () => {
    it('reverts to reading when user lowers progressCurrent below threshold', () => {
      const current = makeReadable({
        status: 'completed',
        progressCurrent: 300,
        totalUnits: 300,
      });
      const result = applyUpdateConsistency({ progressCurrent: 150 }, current);
      expect(result.status).toBe('reading');
      expect(result.progressCurrent).toBe(150);
    });

    it('does NOT revert when status was explicitly set alongside the progress change', () => {
      // User sets both status=completed and progress in one update — their explicit
      // status choice is respected and Rule 3 pins progress to threshold.
      const current = makeReadable({
        status: 'reading',
        progressCurrent: 100,
        totalUnits: 300,
      });
      const result = applyUpdateConsistency({ status: 'completed', progressCurrent: 100 }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(300);
    });

    it('does NOT revert on a title-only update for a completed readable', () => {
      const current = makeReadable({
        status: 'completed',
        progressCurrent: 300,
        totalUnits: 300,
      });
      const result = applyUpdateConsistency({ title: 'New Title' }, current);
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(300);
    });
  });

  // Rule 4: dnf preserves partial progress
  describe('Rule 4: dnf preserves partial progress', () => {
    it('does not alter progressCurrent when setting status to dnf', () => {
      const current = makeReadable({ status: 'reading', progressCurrent: 75, totalUnits: 300 });
      const result = applyUpdateConsistency({ status: 'dnf' }, current);
      expect(result.status).toBe('dnf');
      expect(result.progressCurrent).toBe(75);
    });
  });

  // Rule 5: want_to_read → clear progressCurrent
  describe('Rule 5: want_to_read clears progressCurrent', () => {
    it('clears progressCurrent when status changes to want_to_read', () => {
      const current = makeReadable({ status: 'reading', progressCurrent: 40, totalUnits: 200 });
      const result = applyUpdateConsistency({ status: 'want_to_read' }, current);
      expect(result.status).toBe('want_to_read');
      expect(result.progressCurrent).toBeNull();
    });

    it('does NOT fire when rule 1 promoted status away from want_to_read', () => {
      // Rule 1 fires (progress entered), status → reading, then rule 5 does not fire
      const current = makeReadable({ status: 'want_to_read' });
      const result = applyUpdateConsistency({ progressCurrent: 10 }, current);
      expect(result.status).toBe('reading');
      expect(result.progressCurrent).toBe(10);
    });
  });

  // isComplete coherence rule
  describe('isComplete coherence: isComplete=true with unknown total → false', () => {
    it('downgrades isComplete to false when totalUnits is cleared', () => {
      const current = makeReadable({
        kind: 'fanfic',
        isComplete: true,
        progressCurrent: 10,
        totalUnits: 10,
      });
      // User clears totalUnits → isComplete=true becomes impossible
      const result = applyUpdateConsistency({ totalUnits: null }, current);
      expect(result.isComplete).toBe(false);
    });

    it('leaves isComplete=true unchanged when totalUnits is still known', () => {
      const current = makeReadable({
        kind: 'fanfic',
        isComplete: true,
        progressCurrent: 10,
        totalUnits: 10,
      });
      const result = applyUpdateConsistency({ title: 'New Title' }, current);
      // isComplete key absent from result (no change was needed)
      expect(result.isComplete).toBeUndefined();
    });

    it('leaves isComplete=false unchanged', () => {
      const current = makeReadable({ kind: 'fanfic', isComplete: false, totalUnits: null });
      const result = applyUpdateConsistency({ progressCurrent: 3 }, current);
      expect(result.isComplete).toBeUndefined(); // not changed
    });
  });

  // Combined scenarios
  describe('combined rule interactions', () => {
    it('progress entered that also reaches total → completed + progressCurrent=total', () => {
      const current = makeReadable({ status: 'want_to_read', totalUnits: 5 });
      const result = applyUpdateConsistency({ progressCurrent: 5 }, current);
      // Rule 1 fires → reading, Rule 2 fires → completed, Rule 3 pins → current=5
      expect(result.status).toBe('completed');
      expect(result.progressCurrent).toBe(5);
    });

    it('no-op input: returns status/progressCurrent derived from current state', () => {
      const current = makeReadable({ status: 'reading', progressCurrent: 10, totalUnits: 20 });
      const result = applyUpdateConsistency({ title: 'Updated' }, current);
      expect(result.status).toBe('reading');
      expect(result.progressCurrent).toBe(10);
    });
  });
});

// ── applyCreateConsistency ────────────────────────────────────────────────────

describe('applyCreateConsistency', () => {
  // Rule 1: progress entered on want_to_read → reading
  describe('Rule 1: progress on want_to_read', () => {
    it('auto-changes status to reading when progressCurrent is provided', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'want_to_read', progressCurrent: 5 }),
      );
      expect(result.status).toBe('reading');
    });

    it('does NOT fire when progressCurrent is null', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'want_to_read', progressCurrent: null }),
      );
      expect(result.status).toBe('want_to_read');
    });
  });

  // Rule 2: progressCurrent reaches totalUnits → completed
  describe('Rule 2: progress reaches total', () => {
    it('auto-changes to completed when current === total', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'want_to_read', progressCurrent: 300, totalUnits: 300 }),
      );
      expect(result.status).toBe('completed');
    });

    it('auto-changes to completed when current > total', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'reading', progressCurrent: 310, totalUnits: 300 }),
      );
      expect(result.status).toBe('completed');
    });
  });

  // Rule 3: completed + total → progressCurrent = totalUnits
  describe('Rule 3: completed syncs progressCurrent', () => {
    it('sets progressCurrent to totalUnits when status is completed and total is known', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'completed', progressCurrent: 100, totalUnits: 300 }),
      );
      expect(result.progressCurrent).toBe(300);
    });
  });

  // Rule 5: want_to_read → clear progressCurrent
  describe('Rule 5: want_to_read clears progressCurrent', () => {
    it('keeps progressCurrent null when no progress provided on want_to_read', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ status: 'want_to_read', progressCurrent: null }),
      );
      expect(result.progressCurrent).toBeNull();
    });
  });

  // isComplete safety rule
  describe('isComplete safety: isComplete=true with unknown total → false', () => {
    it('downgrades isComplete to false when totalUnits is absent', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ kind: 'fanfic', isComplete: true, totalUnits: undefined }),
      );
      expect(result.isComplete).toBe(false);
    });

    it('leaves isComplete=true when totalUnits is provided', () => {
      const result = applyCreateConsistency(
        makeCreateInput({
          kind: 'fanfic',
          isComplete: true,
          progressCurrent: 12,
          totalUnits: 12,
        }),
      );
      expect(result.isComplete).toBe(true);
    });

    it('leaves isComplete=false unchanged', () => {
      const result = applyCreateConsistency(
        makeCreateInput({ kind: 'fanfic', isComplete: false }),
      );
      expect(result.isComplete).toBe(false);
    });

    it('leaves isComplete=null unchanged', () => {
      // null is spread from input unchanged (the safety rule only fires when true)
      const result = applyCreateConsistency(makeCreateInput({ isComplete: null }));
      expect(result.isComplete).toBeNull();
    });
  });
});
