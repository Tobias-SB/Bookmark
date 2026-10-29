import * as fc from 'fast-check';
import type { Book, Fanfic } from '../../../readables/domain/readable';
import { AO3_OWNED_FIELDS, type Ao3Snapshot } from '../ao3Snapshot';
import { planAo3Update, stripAo3OwnedFields } from '../ao3Update';

const NOW = '2026-10-29T12:00:00.000Z';

function fanfic(overrides: Partial<Fanfic> = {}): Fanfic {
  return {
    id: 'r1', kind: 'fanfic', title: 'Work', authors: ['author'], status: 'reading',
    progressCurrent: 3, totalUnits: null, sourceType: 'ao3',
    sourceUrl: 'https://archiveofourown.org/works/1', sourceId: '1', summary: 'Summary',
    userTags: ['mine'], isFavourite: false, seriesKey: null, seriesName: null, seriesPart: null,
    seriesTotal: null, startedAt: null, finishedAt: null, lastReadAt: null, readCount: 0,
    dateAdded: NOW, createdAt: NOW, updatedAt: NOW, isComplete: false, isAbandoned: false,
    availableChapters: 5, wordCount: 10000, fandoms: ['A', 'B'], relationships: [], characters: [],
    categories: ['Gen'], ao3Tags: ['Fluff'], rating: 'teen',
    archiveWarnings: ['No Archive Warnings Apply'], authorType: 'known',
    publishedAt: '2026-01-01', ao3UpdatedAt: '2026-02-01',
    ...overrides,
  };
}

const book: Book = {
  id: 'b1', kind: 'book', title: 'Book', authors: ['a'], status: 'reading', progressCurrent: 1,
  totalUnits: 100, sourceType: 'manual', sourceUrl: null, sourceId: null, summary: null,
  userTags: [], isFavourite: false, seriesKey: null, seriesName: null, seriesPart: null,
  seriesTotal: null, startedAt: null, finishedAt: null, lastReadAt: null, readCount: 0,
  dateAdded: NOW, createdAt: NOW, updatedAt: NOW, progressUnit: 'pages', format: null,
  isbn13: null, publishedDate: null, isOwned: null,
};

const snap = (overrides: Partial<Ao3Snapshot> = {}): Ao3Snapshot => ({
  workId: '1', url: 'https://archiveofourown.org/works/1', ...overrides,
});

describe('planAo3Update', () => {
  it('reports no change for an empty snapshot', () => {
    const plan = planAo3Update(fanfic(), snap(), NOW);
    expect(plan).toEqual({
      changed: false, patch: { kind: 'fanfic' }, changes: [], statusPatch: null,
      statusReverted: false, suggestMarkFinished: false,
    });
  });

  it('reports no change when every field matches, comparing arrays as sets', () => {
    const plan = planAo3Update(fanfic(), snap({
      title: 'Work', fandoms: ['B', 'A', 'A'], availableChapters: 5, totalUnits: null,
      rating: 'teen', isComplete: false, wordCount: 10000,
    }), NOW);
    expect(plan.changed).toBe(false);
    expect(plan.patch).toEqual({ kind: 'fanfic' });
  });

  it('leaves fields alone when undefined and overwrites on null or []', () => {
    const plan = planAo3Update(fanfic(), snap({ summary: null, ao3Tags: [], wordCount: undefined }), NOW);
    expect(plan.patch).toEqual({ kind: 'fanfic', summary: null, ao3Tags: [] });
    expect(plan.changes).toEqual([
      { field: 'summary', before: 'Summary', after: null, severity: 'info' },
      { field: 'ao3Tags', before: ['Fluff'], after: [], added: [], removed: ['Fluff'], severity: 'info' },
    ]);
  });

  it('carries added and removed for array changes', () => {
    const plan = planAo3Update(fanfic(), snap({ fandoms: ['B', 'C'] }), NOW);
    expect(plan.changes).toEqual([
      { field: 'fandoms', before: ['A', 'B'], after: ['B', 'C'], added: ['C'], removed: ['A'], severity: 'info' },
    ]);
  });

  it('assigns severities and orders safety, then progress, then info', () => {
    const plan = planAo3Update(fanfic(), snap({
      title: 'New', availableChapters: 6, totalUnits: 10, isComplete: true, rating: 'mature',
      archiveWarnings: ['Major Character Death'],
    }), NOW);
    expect(plan.changes.map((c) => [c.field, c.severity])).toEqual([
      ['rating', 'safety'], ['archiveWarnings', 'safety'],
      ['availableChapters', 'progress'], ['totalUnits', 'progress'], ['isComplete', 'progress'],
      ['title', 'info'],
    ]);
  });

  it('writes a total that becomes unknown (AO3 "?") as null with progress severity', () => {
    const plan = planAo3Update(fanfic({ totalUnits: 10 }), snap({ totalUnits: null }), NOW);
    expect(plan.patch).toEqual({ kind: 'fanfic', totalUnits: null });
    expect(plan.changes).toEqual([{ field: 'totalUnits', before: 10, after: null, severity: 'progress' }]);
  });

  it('maps series to seriesKey, seriesName, seriesPart and seriesTotal', () => {
    const plan = planAo3Update(fanfic(), snap({ series: { seriesId: '42', name: 'S', part: 2, total: 3 } }), NOW);
    expect(plan.patch).toEqual({
      kind: 'fanfic', seriesKey: 'ao3:42', seriesName: 'S', seriesPart: 2, seriesTotal: 3,
    });
  });

  it('keeps a stored series total when the total is unknown in the same series', () => {
    const current = fanfic({ seriesKey: 'ao3:42', seriesName: 'S', seriesPart: 2, seriesTotal: 7 });
    const plan = planAo3Update(current, snap({ series: { seriesId: '42', name: 'S', part: 2 } }), NOW);
    expect(plan.changed).toBe(false);
  });

  it('clears a stale series total when the work moves to another series', () => {
    const current = fanfic({ seriesKey: 'ao3:42', seriesName: 'S', seriesPart: 2, seriesTotal: 7 });
    const plan = planAo3Update(current, snap({ series: { seriesId: '9', name: 'T', part: 1 } }), NOW);
    expect(plan.patch).toEqual({
      kind: 'fanfic', seriesKey: 'ao3:9', seriesName: 'T', seriesPart: 1, seriesTotal: null,
    });
  });

  it('clears every series field when the work has left its series', () => {
    const current = fanfic({ seriesKey: 'ao3:42', seriesName: 'S', seriesPart: 2, seriesTotal: 7 });
    const plan = planAo3Update(current, snap({ series: null }), NOW);
    expect(plan.patch).toEqual({
      kind: 'fanfic', seriesKey: null, seriesName: null, seriesPart: null, seriesTotal: null,
    });
    expect(plan.changes.map((c) => c.severity)).toEqual(['info', 'info', 'info', 'info']);
  });

  it('keeps stored series fields when the snapshot omits series', () => {
    const current = fanfic({ seriesKey: 'ao3:42', seriesName: 'S', seriesPart: 2, seriesTotal: 7 });
    expect(planAo3Update(current, snap(), NOW).changed).toBe(false);
  });

  it('never puts user-owned fields such as isAbandoned in the patch', () => {
    const plan = planAo3Update(fanfic(), snap({ hasAbandonedTag: true, title: 'New' }), NOW);
    expect(plan.patch).toEqual({ kind: 'fanfic', title: 'New' });
  });

  describe('status reversion', () => {
    it('reverts completed to reading when chapters exceed progress', () => {
      const plan = planAo3Update(fanfic({ status: 'completed', progressCurrent: 5 }), snap({ availableChapters: 6 }), NOW);
      expect(plan).toMatchObject({ changed: true, statusPatch: { status: 'reading' }, statusReverted: true });
    });

    it('treats null progress as 0', () => {
      const plan = planAo3Update(
        fanfic({ status: 'completed', progressCurrent: null, availableChapters: 1 }), snap({ availableChapters: 1 }), NOW);
      expect(plan.statusReverted).toBe(true);
      expect(plan.changed).toBe(true);
    });

    it.each([
      ['not completed', fanfic({ status: 'reading', progressCurrent: 5 }), snap({ availableChapters: 6 })],
      ['caught up', fanfic({ status: 'completed', progressCurrent: 6 }), snap({ availableChapters: 6 })],
      ['chapters unknown', fanfic({ status: 'completed', progressCurrent: 1 }), snap()],
    ])('does not revert when %s', (_label, current, incoming) => {
      const plan = planAo3Update(current, incoming, NOW);
      expect(plan.statusPatch).toBeNull();
      expect(plan.statusReverted).toBe(false);
    });
  });

  describe('suggestMarkFinished', () => {
    it('is true when the work becomes complete and the reader is on the last chapter', () => {
      const plan = planAo3Update(fanfic({ progressCurrent: 5 }), snap({ isComplete: true, availableChapters: 5 }), NOW);
      expect(plan.suggestMarkFinished).toBe(true);
      expect(plan.statusPatch).toBeNull();
    });

    it('uses the stored chapter count when the snapshot omits it', () => {
      const plan = planAo3Update(fanfic({ progressCurrent: 5 }), snap({ isComplete: true }), NOW);
      expect(plan.suggestMarkFinished).toBe(true);
    });

    it.each([
      ['already complete', fanfic({ isComplete: true, progressCurrent: 5 }), snap({ isComplete: true })],
      ['still a WIP', fanfic({ progressCurrent: 5 }), snap({ isComplete: false })],
      ['completion unknown', fanfic({ progressCurrent: 5 }), snap()],
      ['behind', fanfic({ progressCurrent: 4 }), snap({ isComplete: true, availableChapters: 6 })],
      ['not reading', fanfic({ status: 'dnf', progressCurrent: 5 }), snap({ isComplete: true })],
      ['chapters unknown', fanfic({ availableChapters: null, progressCurrent: 5 }), snap({ isComplete: true })],
    ])('is false when %s', (_label, current, incoming) => {
      expect(planAo3Update(current, incoming, NOW).suggestMarkFinished).toBe(false);
    });
  });

  it('patch keys are always a subset of AO3_OWNED_FIELDS and match the changes', () => {
    const owned = new Set<string>(AO3_OWNED_FIELDS);
    const strings = fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { maxLength: 4 });
    const snapshotArb = fc.record({
      workId: fc.constant('1'),
      url: fc.constant('https://archiveofourown.org/works/1'),
      title: fc.string(), authors: strings, summary: fc.option(fc.string()), fandoms: strings,
      relationships: strings, characters: strings, categories: strings, ao3Tags: strings,
      archiveWarnings: strings, rating: fc.option(fc.constantFrom('general' as const, 'teen' as const, 'explicit' as const)),
      availableChapters: fc.nat(50), totalUnits: fc.option(fc.nat(50)), wordCount: fc.option(fc.nat()),
      isComplete: fc.boolean(), publishedAt: fc.option(fc.string()), ao3UpdatedAt: fc.option(fc.string()),
      hasAbandonedTag: fc.boolean(),
      series: fc.option(fc.record({ seriesId: fc.string(), name: fc.string(), part: fc.nat(), total: fc.option(fc.nat()) },
        { requiredKeys: ['seriesId', 'name', 'part'] })),
    }, { requiredKeys: ['workId', 'url'] });
    const currentArb = fc.record({
      status: fc.constantFrom('want_to_read' as const, 'reading' as const, 'completed' as const, 'dnf' as const),
      progressCurrent: fc.option(fc.nat(50)), isComplete: fc.boolean(), fandoms: strings,
    }).map((o) => fanfic(o));

    fc.assert(fc.property(currentArb, snapshotArb, (current, incoming) => {
      const plan = planAo3Update(current, incoming, NOW);
      const keys = Object.keys(plan.patch).filter((k) => k !== 'kind');
      expect(keys.every((k) => owned.has(k))).toBe(true);
      expect(keys.sort()).toEqual(plan.changes.map((c) => c.field).sort());
      expect(plan.changed).toBe(plan.changes.length > 0 || plan.statusReverted);
      // undefined leaves the stored value alone; seriesTotal alone may clear when the series changes.
      const source: Record<string, unknown> = { ...incoming };
      for (const key of keys.filter((k) => k !== 'seriesTotal')) {
        expect(key.startsWith('series') ? incoming.series : source[key]).not.toBeUndefined();
      }
      // Applying the patch makes a second plan a no-op on fields.
      const applied = planAo3Update({ ...current, ...plan.patch }, incoming, NOW);
      expect(applied.changes).toEqual([]);
    }));
  });
});

describe('stripAo3OwnedFields', () => {
  const userPatch = {
    kind: 'fanfic' as const, title: 'Mine', rating: 'explicit' as const, availableChapters: 9,
    seriesKey: 'name:x', status: 'dnf' as const, isAbandoned: true, userTags: ['t'],
  };

  it('removes owned fields from patches on AO3 fanfic', () => {
    expect(stripAo3OwnedFields(fanfic(), userPatch)).toEqual({
      kind: 'fanfic', status: 'dnf', isAbandoned: true, userTags: ['t'],
    });
  });

  it('does not mutate the input patch', () => {
    const patch = { ...userPatch };
    stripAo3OwnedFields(fanfic(), patch);
    expect(patch).toEqual(userPatch);
  });

  it('leaves manual fanfic patches untouched', () => {
    expect(stripAo3OwnedFields(fanfic({ sourceType: 'manual' }), userPatch)).toEqual(userPatch);
  });

  it('passes a book patch on AO3 fanfic through unchanged (the repository rejects the kind mismatch)', () => {
    const patch = { kind: 'book' as const, title: 'New', totalUnits: 300 };
    expect(stripAo3OwnedFields(fanfic(), patch)).toEqual(patch);
  });

  it('leaves book patches untouched', () => {
    const patch = { kind: 'book' as const, title: 'New', totalUnits: 300 };
    expect(stripAo3OwnedFields(book, patch)).toEqual(patch);
  });
});
