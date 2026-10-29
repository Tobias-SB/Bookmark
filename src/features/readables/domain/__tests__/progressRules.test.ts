import { applyProgressChange, type ProgressChange } from '../progressRules';
import {
  chaptersBehind,
  isFinalPosition,
  progressCeiling,
  progressUnitFor,
  readingStateOf,
  type Readable,
} from '../readable';
import { makeBook, makeFanfic } from './fixtures';

const NOW = '2026-06-01T12:00:00.000Z';

function run(r: Readable, c: ProgressChange) {
  const res = applyProgressChange(r, c, NOW);
  if (!res.ok) throw new Error(res.error.message);
  return res;
}
const types = (r: ReturnType<typeof run>) => r.events.map((e) => e.type);

describe('applyProgressChange: progress set', () => {
  it('above 0 while want_to_read starts reading', () => {
    const r = run(makeBook({ totalUnits: 300 }), { progressCurrent: 10 });
    expect(r.patch).toMatchObject({ status: 'reading', startedAt: NOW, progressCurrent: 10, lastReadAt: NOW });
    expect(types(r)).toEqual(['started']);
    expect(r.events[0]).toMatchObject({ readableId: 'b1', at: NOW, unitsAtEvent: 300, wordsAtEvent: null });
  });
  it('keeps an existing startedAt', () => {
    const r = run(makeBook({ totalUnits: 300, startedAt: 'old' }), { progressCurrent: 10 });
    expect(r.patch).toMatchObject({ startedAt: 'old' });
  });
  it('0 while want_to_read does not start', () => {
    const r = run(makeBook({ totalUnits: 300 }), { progressCurrent: 0 });
    expect(r.patch).toMatchObject({ status: 'want_to_read' });
    expect(r.events).toEqual([]);
  });
  it('reaching the final position completes', () => {
    const r = run(makeBook({ status: 'reading', totalUnits: 300, readCount: 1 }), { progressCurrent: 300 });
    expect(r.patch).toMatchObject({ status: 'completed', finishedAt: NOW, readCount: 2 });
    expect(types(r)).toEqual(['finished']);
  });
  it('jumping from want_to_read to final emits started then finished', () => {
    const r = run(makeBook({ totalUnits: 300 }), { progressCurrent: 300 });
    expect(types(r)).toEqual(['started', 'finished']);
  });
  it('percent book completes at 100', () => {
    const r = run(makeBook({ progressUnit: 'percent', status: 'reading' }), { progressCurrent: 100 });
    expect(r.patch).toMatchObject({ status: 'completed' });
  });
  it('book without a ceiling never auto-completes', () => {
    const r = run(makeBook({ status: 'reading' }), { progressCurrent: 5000 });
    expect(r.patch).toMatchObject({ status: 'reading' });
  });
  it('WIP fanfic reaching availableChapters stays reading (caught up)', () => {
    const f = makeFanfic({ status: 'reading', availableChapters: 8, totalUnits: 20 });
    const r = run(f, { progressCurrent: 8 });
    expect(r.patch).toMatchObject({ status: 'reading' });
    expect(r.events).toEqual([]);
    expect(readingStateOf({ ...f, progressCurrent: 8 })).toBe('caught_up');
  });
  it('complete fanfic reaching totalUnits completes with words in the event', () => {
    const f = makeFanfic({ status: 'reading', isComplete: true, totalUnits: 5, availableChapters: 5, wordCount: 9000 });
    const r = run(f, { progressCurrent: 5 });
    expect(r.patch).toMatchObject({ status: 'completed' });
    expect(r.events[0]).toMatchObject({ wordsAtEvent: 9000, unitsAtEvent: 5 });
  });
  it('lowering below final while completed returns to reading, readCount unchanged', () => {
    const b = makeBook({ status: 'completed', totalUnits: 300, progressCurrent: 300, readCount: 1 });
    const r = run(b, { progressCurrent: 100 });
    expect(r.patch).toMatchObject({ status: 'reading', readCount: 1 });
    expect(r.events).toEqual([]);
  });
  it('null progress while completed returns to reading', () => {
    const r = run(makeBook({ status: 'completed', totalUnits: 300, progressCurrent: 300 }), { progressCurrent: null });
    expect(r.patch).toMatchObject({ status: 'reading', progressCurrent: null });
  });
  it('setting the same final value while completed does not recount', () => {
    const b = makeBook({ status: 'completed', totalUnits: 300, progressCurrent: 300, readCount: 1 });
    const r = run(b, { progressCurrent: 300 });
    expect(r.patch).toMatchObject({ status: 'completed', readCount: 1 });
    expect(r.events).toEqual([]);
  });
  it('dnf stays dnf on non-final progress', () => {
    const r = run(makeBook({ status: 'dnf', totalUnits: 300 }), { progressCurrent: 50 });
    expect(r.patch).toMatchObject({ status: 'dnf' });
  });
});

describe('applyProgressChange: increment', () => {
  it('adds one unit from null', () => {
    const r = run(makeFanfic({ availableChapters: 5 }), { increment: 1 });
    expect(r.patch).toMatchObject({ progressCurrent: 1, status: 'reading' });
    expect(types(r)).toEqual(['started']);
  });
  it('completes a book on the last page', () => {
    const r = run(makeBook({ status: 'reading', totalUnits: 10, progressCurrent: 9 }), { increment: 1 });
    expect(r.patch).toMatchObject({ progressCurrent: 10, status: 'completed' });
  });
  it('past the ceiling is a validation error', () => {
    const b = makeBook({ status: 'reading', totalUnits: 10, progressCurrent: 10 });
    expect(applyProgressChange(b, { increment: 1 }, NOW)).toMatchObject({ ok: false, error: { code: 'validation' } });
  });
});

describe('applyProgressChange: status set', () => {
  it('completed on a book with a ceiling sets progress to it', () => {
    const b = makeBook({ status: 'reading', totalUnits: 300, progressCurrent: 5, readCount: 2 });
    const r = run(b, { status: 'completed' });
    expect(r.patch).toMatchObject({ status: 'completed', progressCurrent: 300, finishedAt: NOW, readCount: 3 });
    expect(types(r)).toEqual(['finished']);
  });
  it('completed on a complete fanfic uses totalUnits', () => {
    const f = makeFanfic({ status: 'reading', isComplete: true, totalUnits: 12, availableChapters: 12 });
    expect(run(f, { status: 'completed' }).patch).toMatchObject({ progressCurrent: 12 });
  });
  it('completed on a WIP uses availableChapters', () => {
    const f = makeFanfic({ status: 'reading', availableChapters: 7, progressCurrent: 2 });
    expect(run(f, { status: 'completed' }).patch).toMatchObject({ progressCurrent: 7, status: 'completed' });
  });
  it('completed with no known target keeps progress', () => {
    const r = run(makeBook({ status: 'reading', progressCurrent: 42 }), { status: 'completed' });
    expect(r.patch).toMatchObject({ progressCurrent: 42, status: 'completed' });
  });
  it('dnf preserves progress and emits dnf', () => {
    const r = run(makeBook({ status: 'reading', totalUnits: 300, progressCurrent: 50 }), { status: 'dnf' });
    expect(r.patch).toMatchObject({ status: 'dnf', progressCurrent: 50 });
    expect(types(r)).toEqual(['dnf']);
  });
  it('want_to_read clears progress, keeps dates and read count', () => {
    const b = makeBook({ status: 'completed', progressCurrent: 300, startedAt: 's', finishedAt: 'f', readCount: 2 });
    const r = run(b, { status: 'want_to_read' });
    expect(r.patch).toMatchObject({ progressCurrent: null, startedAt: 's', finishedAt: 'f', readCount: 2 });
    expect(r.events).toEqual([]);
  });
  it('reading from want_to_read starts', () => {
    const r = run(makeBook(), { status: 'reading' });
    expect(r.patch).toMatchObject({ startedAt: NOW });
    expect(types(r)).toEqual(['started']);
  });
  it('reading from want_to_read keeps an existing startedAt', () => {
    expect(run(makeBook({ startedAt: 'old' }), { status: 'reading' }).patch).toMatchObject({ startedAt: 'old' });
  });
  it('reading from dnf emits nothing', () => {
    expect(run(makeBook({ status: 'dnf' }), { status: 'reading' }).events).toEqual([]);
  });
  it('same status is a no-op apart from lastReadAt', () => {
    const r = run(makeBook({ status: 'completed', readCount: 1 }), { status: 'completed' });
    expect(r.patch).toMatchObject({ readCount: 1 });
    expect(r.events).toEqual([]);
  });
});

describe('applyProgressChange: startReread', () => {
  it.each(['completed', 'dnf'] as const)('from %s', (status) => {
    const r = run(makeBook({ status, progressCurrent: 5, startedAt: 'old', readCount: 1 }), { startReread: true });
    expect(r.patch).toMatchObject({
      status: 'reading',
      progressCurrent: null,
      startedAt: NOW,
      readCount: 1,
      lastReadAt: NOW,
    });
    expect(types(r)).toEqual(['reread_started']);
  });
  it.each(['reading', 'want_to_read'] as const)('from %s is rejected', (status) => {
    expect(applyProgressChange(makeBook({ status }), { startReread: true }, NOW)).toMatchObject({ ok: false });
  });
});

describe('applyProgressChange: validation', () => {
  it.each([-1, 1.5, Number.NaN])('rejects progress %s', (p) => {
    expect(applyProgressChange(makeBook(), { progressCurrent: p }, NOW)).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
  });
  it('rejects percent over 100', () => {
    const b = makeBook({ progressUnit: 'percent' });
    expect(applyProgressChange(b, { progressCurrent: 101 }, NOW)).toMatchObject({ ok: false });
  });
  it('rejects progress above the book total', () => {
    expect(applyProgressChange(makeBook({ totalUnits: 10 }), { progressCurrent: 11 }, NOW)).toMatchObject({ ok: false });
  });
  it('rejects progress above availableChapters', () => {
    const f = makeFanfic({ availableChapters: 3 });
    expect(applyProgressChange(f, { progressCurrent: 4 }, NOW)).toMatchObject({ ok: false });
  });
  it('rejects availableChapters above totalUnits', () => {
    const f = makeFanfic({ availableChapters: 9, totalUnits: 5 });
    expect(applyProgressChange(f, { progressCurrent: 1 }, NOW)).toMatchObject({ ok: false });
  });
  it('allows any progress for an unknown ceiling', () => {
    expect(applyProgressChange(makeFanfic(), { progressCurrent: 40 }, NOW)).toMatchObject({ ok: true });
  });
});

describe('derived values (§6.6)', () => {
  it('progressUnitFor', () => {
    expect(progressUnitFor(makeFanfic())).toBe('chapters');
    expect(progressUnitFor(makeBook({ progressUnit: 'minutes' }))).toBe('minutes');
  });
  it('progressCeiling', () => {
    expect(progressCeiling(makeFanfic({ availableChapters: 4, totalUnits: 9 }))).toBe(4);
    expect(progressCeiling(makeFanfic({ totalUnits: 9 }))).toBe(9);
    expect(progressCeiling(makeFanfic())).toBeNull();
    expect(progressCeiling(makeBook({ progressUnit: 'percent', totalUnits: null }))).toBe(100);
    expect(progressCeiling(makeBook({ totalUnits: 50 }))).toBe(50);
  });
  it('isFinalPosition', () => {
    expect(isFinalPosition(makeBook({ totalUnits: 5 }), 5)).toBe(true);
    expect(isFinalPosition(makeBook(), 5)).toBe(false);
    expect(isFinalPosition(makeFanfic({ isComplete: true, totalUnits: 3 }), 3)).toBe(true);
    expect(isFinalPosition(makeFanfic({ isComplete: false, totalUnits: 3 }), 3)).toBe(false);
    expect(isFinalPosition(makeFanfic({ isComplete: true }), 3)).toBe(false);
  });
  it('chaptersBehind', () => {
    expect(chaptersBehind(makeFanfic({ status: 'reading', availableChapters: 8, progressCurrent: 5 }))).toBe(3);
    expect(chaptersBehind(makeFanfic({ status: 'completed', availableChapters: 8 }))).toBe(8);
    expect(chaptersBehind(makeFanfic({ status: 'dnf', availableChapters: 8 }))).toBe(0);
    expect(chaptersBehind(makeFanfic({ status: 'want_to_read', availableChapters: 8 }))).toBe(0);
    expect(chaptersBehind(makeFanfic({ status: 'reading' }))).toBe(0);
    expect(chaptersBehind(makeFanfic({ status: 'reading', availableChapters: 2, progressCurrent: 5 }))).toBe(0);
  });
  it('readingStateOf', () => {
    const wip = { availableChapters: 8 };
    expect(readingStateOf(makeBook())).toBe('not_started');
    expect(readingStateOf(makeBook({ status: 'reading' }))).toBe('in_progress');
    expect(readingStateOf(makeBook({ status: 'completed' }))).toBe('finished');
    expect(readingStateOf(makeBook({ status: 'dnf' }))).toBe('dnf');
    expect(readingStateOf(makeFanfic({ ...wip, status: 'reading', progressCurrent: 5 }))).toBe('new_chapters');
    expect(readingStateOf(makeFanfic({ ...wip, status: 'completed', progressCurrent: 5 }))).toBe('new_chapters');
    expect(readingStateOf(makeFanfic({ ...wip, status: 'completed', isComplete: true, progressCurrent: 8 }))).toBe('finished');
    expect(readingStateOf(makeFanfic({ ...wip, status: 'reading', isComplete: true, progressCurrent: 5 }))).toBe('in_progress');
    expect(readingStateOf(makeFanfic({ ...wip, status: 'reading', progressCurrent: 8 }))).toBe('caught_up');
  });
});
