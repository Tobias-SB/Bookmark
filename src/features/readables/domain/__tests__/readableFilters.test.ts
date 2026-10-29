import type { ContentPreferences, Readable } from '../readable';
import {
  applyFilters,
  buildVocabulary,
  countActiveFilters,
  DEFAULT_FILTERS,
  type ReadableFilters,
} from '../readableFilters';
import { makeBook, makeFanfic } from './fixtures';

const NO_PREFS: ContentPreferences = { hiddenWarnings: [], hiddenRatings: [] };
const F = (over: Partial<ReadableFilters>): ReadableFilters => ({ version: 1, ...over });
const ids = (rs: Readable[]) => rs.map((r) => r.id);
const run = (rs: Readable[], f: Partial<ReadableFilters>, notes = {}, prefs: ContentPreferences = NO_PREFS) =>
  applyFilters(rs, notes, F(f), prefs);

const book = (id: string, over = {}) => makeBook({ id, title: id, ...over });
const fic = (id: string, over = {}) => makeFanfic({ id, title: id, ...over });

describe('applyFilters: axes', () => {
  const rs = [
    book('b-want', { status: 'want_to_read', isOwned: false }),
    book('b-owned', { status: 'reading', isOwned: true, isFavourite: true }),
    book('b-unset', { status: 'completed' }),
    fic('f-wip', { status: 'reading', availableChapters: 5, progressCurrent: 2, seriesKey: 'name:x' }),
    fic('f-done', { status: 'completed', isComplete: true, isAbandoned: true, rating: 'mature' }),
  ];

  it('kind', () => {
    expect(ids(run(rs, { kind: 'book' }).items).sort()).toEqual(['b-owned', 'b-unset', 'b-want']);
    expect(ids(run(rs, { kind: 'fanfic' }).items).sort()).toEqual(['f-done', 'f-wip']);
  });
  it('status is OR', () => {
    expect(ids(run(rs, { status: ['want_to_read', 'completed'] }).items).sort()).toEqual(['b-unset', 'b-want', 'f-done']);
  });
  it('empty arrays are ignored', () => {
    expect(run(rs, { status: [], fandoms: [], includeTags: [] }).items).toHaveLength(5);
  });
  it('readingState is OR and derived', () => {
    expect(ids(run(rs, { readingState: ['new_chapters'] }).items)).toEqual(['f-wip']);
    expect(ids(run(rs, { readingState: ['not_started', 'finished'] }).items).sort()).toEqual(['b-unset', 'b-want', 'f-done']);
  });
  it('favouritesOnly', () => {
    expect(ids(run(rs, { favouritesOnly: true }).items)).toEqual(['b-owned']);
  });
  it('seriesOnly', () => {
    expect(ids(run(rs, { seriesOnly: true }).items)).toEqual(['f-wip']);
  });
  it('ownership owned / not_owned (null is neither); fanfic never matches', () => {
    expect(ids(run(rs, { ownership: 'owned' }).items)).toEqual(['b-owned']);
    expect(ids(run(rs, { ownership: 'not_owned' }).items)).toEqual(['b-want']);
  });
  it('isComplete and isAbandoned are fanfic only', () => {
    expect(ids(run(rs, { isComplete: true }).items)).toEqual(['f-done']);
    expect(ids(run(rs, { isComplete: false }).items)).toEqual(['f-wip']);
    expect(ids(run(rs, { isAbandoned: true }).items)).toEqual(['f-done']);
    expect(ids(run(rs, { isAbandoned: false }).items).sort()).toEqual(['b-owned', 'b-unset', 'b-want', 'f-wip']);
  });
  it('ratings OR; null rating never matches', () => {
    expect(ids(run(rs, { ratings: ['mature', 'teen'] }).items)).toEqual(['f-done']);
  });
  it('shelfId is not applied by applyFilters', () => {
    expect(run(rs, { shelfId: 'shelf_x' }).items).toHaveLength(5);
  });
});

describe('applyFilters: fanfic lists and tags', () => {
  const rs = [
    fic('a', { fandoms: ['Harry Potter'], relationships: ['A/B'], characters: ['Ä'], categories: ['M/M'], archiveWarnings: ['Underage'], ao3Tags: ['Angst'] }),
    fic('b', { fandoms: ['Naruto'], relationships: ['C/D'], characters: ['C'], categories: ['Gen'], userTags: ['comfort', 'angst'] }),
    book('bk', { userTags: ['Angst', 'comfort'] }),
  ];
  it('fandom is case-insensitive exact, OR', () => {
    expect(ids(run(rs, { fandoms: ['harry potter', 'x'] }).items)).toEqual(['a']);
    expect(run(rs, { fandoms: ['harry'] }).items).toEqual([]);
  });
  it('relationships, characters (diacritic-insensitive), categories', () => {
    expect(ids(run(rs, { relationships: ['c/d'] }).items)).toEqual(['b']);
    expect(ids(run(rs, { characters: ['a'] }).items)).toEqual(['a']);
    expect(ids(run(rs, { categories: ['gen'] }).items)).toEqual(['b']);
  });
  it('positive fanfic-only filters never match books', () => {
    const all = [...rs, book('plain')];
    expect(ids(run(all, { fandoms: ['Naruto'] }).items)).toEqual(['b']);
    expect(run(all, { isComplete: false }).items.some((r) => r.kind === 'book')).toBe(false);
    expect(run(all, { isAbandoned: true }).items).toEqual([]);
    expect(run(all, { relationships: ['C/D'] }).items.some((r) => r.kind === 'book')).toBe(false);
    expect(run(all, { characters: ['C'] }).items.some((r) => r.kind === 'book')).toBe(false);
    expect(run(all, { categories: ['Gen'] }).items.some((r) => r.kind === 'book')).toBe(false);
    expect(run(all, { ratings: ['teen'] }).items.some((r) => r.kind === 'book')).toBe(false);
  });
  it('exclusion forms let books pass', () => {
    const all = [...rs, book('plain')];
    expect(ids(run(all, { excludeWarnings: ['Nothing'] }).items).sort()).toEqual(['a', 'b', 'bk', 'plain']);
    expect(ids(run(all, { isAbandoned: false }).items).sort()).toEqual(['a', 'b', 'bk', 'plain']);
  });
  it('kind fanfic plus excludeWarnings shows only non-matching fanfic', () => {
    expect(ids(run(rs, { kind: 'fanfic', excludeWarnings: ['Underage'] }).items)).toEqual(['b']);
  });
  it('excludeWarnings hides works with any listed warning', () => {
    expect(ids(run(rs, { excludeWarnings: ['underage', 'x'] }).items)).toEqual(['b', 'bk']);
  });
  it('includeTags is AND over user and AO3 tags', () => {
    expect(ids(run(rs, { includeTags: ['angst'] }).items).sort()).toEqual(['a', 'b', 'bk']);
    expect(ids(run(rs, { includeTags: ['angst', 'comfort'] }).items).sort()).toEqual(['b', 'bk']);
  });
  it('excludeTags is NONE', () => {
    expect(ids(run(rs, { excludeTags: ['comfort'] }).items)).toEqual(['a']);
  });
});

describe('applyFilters: length', () => {
  const rs = [
    fic('short', { wordCount: 1000 }),
    fic('long', { wordCount: 90000 }),
    fic('unknown'),
    book('pages', { totalUnits: 300 }),
    book('mins', { progressUnit: 'minutes', totalUnits: 300 }),
  ];
  it('min and max use words for fanfic and pages for books; unknown never matches', () => {
    expect(ids(run(rs, { lengthMin: 500 }).items).sort()).toEqual(['long', 'short']);
    expect(ids(run(rs, { lengthMax: 1000 }).items)).toEqual(['short', 'pages']);
    expect(ids(run(rs, { lengthMin: 200, lengthMax: 5000 }).items)).toEqual(['short', 'pages']);
  });
  it('no length filter keeps unknowns', () => {
    expect(run(rs, {}).items).toHaveLength(5);
  });
});

describe('applyFilters: search', () => {
  const rs = [
    book('title-hit', { title: 'Café Noir', authors: ['Zed'] }),
    book('author-hit', { authors: ['José Saramago'] }),
    fic('tag-hit', { ao3Tags: ['Slow Burn'] }),
    fic('summary-hit', { summary: 'A quiet winter morning' }),
    fic('fandom-hit', { fandoms: ['Star Trek'] }),
    book('note-hit', { title: 'Plain' }),
  ];
  const notes = { 'note-hit': [{ body: 'Loved the ending' }] };

  it('is case- and diacritic-insensitive (NFKD) in both directions', () => {
    expect(ids(run(rs, { search: 'CAFE' }).items)).toEqual(['title-hit']);
    expect(ids(run(rs, { search: 'café' }).items)).toEqual(['title-hit']);
    expect(ids(run(rs, { search: 'jose' }).items)).toEqual(['author-hit']);
    expect(ids(run(rs, { search: 'ﬁne' }).items)).toEqual([]);
  });
  it('NFKD folds compatibility characters', () => {
    expect(ids(run([book('x', { title: 'ﬁnal' })], { search: 'final' }).items)).toEqual(['x']);
  });
  it('records matchedIn for each field', () => {
    const r = run(rs, { search: 'noir' }, notes);
    expect(r.matchedIn).toEqual({ 'title-hit': 'title' });
    expect(run(rs, { search: 'saramago' }).matchedIn).toEqual({ 'author-hit': 'authors' });
    expect(run(rs, { search: 'burn' }).matchedIn).toEqual({ 'tag-hit': 'tags' });
    expect(run(rs, { search: 'winter' }).matchedIn).toEqual({ 'summary-hit': 'summary' });
    expect(run(rs, { search: 'ending' }, notes).matchedIn).toEqual({ 'note-hit': 'notes' });
    expect(run(rs, { search: 'trek' }).matchedIn).toEqual({ 'fandom-hit': 'other' });
  });
  it('whitespace terms are ANDed, possibly across fields', () => {
    expect(ids(run(rs, { search: 'plain ending' }, notes).items)).toEqual(['note-hit']);
    expect(run(rs, { search: 'plain ending' }, notes).matchedIn).toEqual({ 'note-hit': 'notes' });
    expect(run(rs, { search: 'plain nothing' }, notes).items).toEqual([]);
  });
  it('quoted phrases match exactly', () => {
    expect(ids(run(rs, { search: '"slow burn"' }).items)).toEqual(['tag-hit']);
    expect(run(rs, { search: '"burn slow"' }).items).toEqual([]);
    expect(ids(run(rs, { search: '"quiet winter" morning' }).items)).toEqual(['summary-hit']);
  });
  it('phrases do not span separate values', () => {
    const r = [fic('p', { ao3Tags: ['Slow', 'Burn'] })];
    expect(run(r, { search: '"slow burn"' }).items).toEqual([]);
  });
  it('blank search matches everything and records nothing', () => {
    const r = run(rs, { search: '   ' });
    expect(r.items).toHaveLength(6);
    expect(r.matchedIn).toEqual({});
  });
  it('notes only match for the right readable', () => {
    expect(run(rs, { search: 'ending' }, { other: [{ body: 'ending' }] }).items).toEqual([]);
  });
});

describe('applyFilters: sort', () => {
  const rs = [
    fic('a', { title: 'banana', wordCount: 20, lastReadAt: '2026-02-01', ao3UpdatedAt: '2026-03-01', dateAdded: '2026-01-02', updatedAt: '2026-01-05', authors: ['Zoe'], status: 'reading', availableChapters: 5, progressCurrent: 4 }),
    fic('b', { title: 'Apple', wordCount: 10, lastReadAt: null, ao3UpdatedAt: null, dateAdded: '2026-01-03', updatedAt: '2026-01-04', authors: [], status: 'reading', availableChapters: 9, progressCurrent: 1 }),
    book('c', { title: 'cherry', totalUnits: 500, lastReadAt: '2026-01-01', dateAdded: '2026-01-01', updatedAt: '2026-01-06', authors: ['Adam'] }),
  ];
  const order = (f: Partial<ReadableFilters>) => ids(run(rs, f).items).join('');

  it('default is dateAdded desc', () => {
    expect(order({})).toBe('bac');
    expect(order(DEFAULT_FILTERS)).toBe('bac');
  });
  it('dateAdded asc', () => expect(order({ sortBy: 'dateAdded', sortOrder: 'asc' })).toBe('cab'));
  it('title is case-insensitive, asc by default', () => {
    expect(order({ sortBy: 'title' })).toBe('bac');
    expect(order({ sortBy: 'title', sortOrder: 'desc' })).toBe('cab');
  });
  it('author, nulls last both ways', () => {
    expect(order({ sortBy: 'author' })).toBe('cab');
    expect(order({ sortBy: 'author', sortOrder: 'desc' })).toBe('acb');
  });
  it('updatedAt', () => expect(order({ sortBy: 'updatedAt' })).toBe('cab'));
  it('lastReadAt, nulls last both ways', () => {
    expect(order({ sortBy: 'lastReadAt', sortOrder: 'desc' })).toBe('acb');
    expect(order({ sortBy: 'lastReadAt', sortOrder: 'asc' })).toBe('cab');
  });
  it('length mixes words and pages; nulls last', () => {
    expect(order({ sortBy: 'length', sortOrder: 'asc' })).toBe('bac');
    expect(order({ sortBy: 'length', sortOrder: 'desc' })).toBe('cab');
  });
  it('chaptersBehind defaults to descending; books are null and last', () => {
    expect(order({ sortBy: 'chaptersBehind' })).toBe('bac');
    expect(order({ sortBy: 'chaptersBehind', sortOrder: 'asc' })).toBe('abc');
  });
  it('ao3UpdatedAt nulls last both ways', () => {
    expect(order({ sortBy: 'ao3UpdatedAt', sortOrder: 'asc' })).toBe('abc');
    expect(order({ sortBy: 'ao3UpdatedAt', sortOrder: 'desc' })).toBe('abc');
  });
});

describe('content preferences (§7.8)', () => {
  const rs = [
    fic('ok', { rating: 'teen' }),
    fic('warn', { archiveWarnings: ['Major Character Death'] }),
    fic('explicit', { rating: 'explicit' }),
    fic('both', { rating: 'explicit', archiveWarnings: ['Underage'] }),
    book('book'),
  ];
  const prefs = { hiddenWarnings: ['major character death', 'Underage'], hiddenRatings: ['explicit' as const] };

  it('hides by warning (case-insensitive) or rating and counts each hidden work once', () => {
    const r = run(rs, {}, {}, prefs);
    expect(ids(r.items).sort()).toEqual(['book', 'ok']);
    expect(r.hiddenByPrefsCount).toBe(3);
  });
  it('counts only works that match the active filters', () => {
    const r = run(rs, { kind: 'book' }, {}, prefs);
    expect(r.hiddenByPrefsCount).toBe(0);
    expect(run(rs, { search: 'explicit' }, {}, prefs).hiddenByPrefsCount).toBe(1);
  });
  it('with no prefs nothing is hidden', () => {
    expect(run(rs, {}).hiddenByPrefsCount).toBe(0);
  });
  it('never hides books', () => {
    expect(ids(run([book('b')], {}, {}, prefs).items)).toEqual(['b']);
  });
});

describe('countActiveFilters (§7.2 badge)', () => {
  it('default and empty filters count 0', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ version: 1 })).toBe(0);
    expect(countActiveFilters(F({ status: [], includeTags: [], search: '  ' }))).toBe(0);
  });
  it('counts one per non-empty axis regardless of list length', () => {
    expect(countActiveFilters(F({ status: ['reading', 'dnf'], fandoms: ['a', 'b', 'c'] }))).toBe(2);
  });
  it('counts one per tag', () => {
    expect(countActiveFilters(F({ includeTags: ['a', 'b'], excludeTags: ['c'] }))).toBe(3);
  });
  it('counts scalar axes', () => {
    expect(countActiveFilters(F({ kind: 'book', favouritesOnly: true, seriesOnly: true, ownership: 'owned', shelfId: 's', isComplete: false, isAbandoned: true, search: 'x' }))).toBe(8);
    expect(countActiveFilters(F({ favouritesOnly: false, seriesOnly: false }))).toBe(0);
  });
  it('length min and max together are one axis', () => {
    expect(countActiveFilters(F({ lengthMin: 1, lengthMax: 5 }))).toBe(1);
    expect(countActiveFilters(F({ lengthMax: 0 }))).toBe(1);
  });
  it('a non-default sort adds one', () => {
    expect(countActiveFilters(F({ sortBy: 'title' }))).toBe(1);
    expect(countActiveFilters(F({ sortBy: 'dateAdded', sortOrder: 'asc' }))).toBe(1);
    expect(countActiveFilters(F({ sortBy: 'chaptersBehind' }))).toBe(1);
  });
});

describe('buildVocabulary', () => {
  const rs = [
    fic('a', { fandoms: ['Naruto', 'harry potter'], ao3Tags: ['Angst'], userTags: ['mine'] }),
    fic('b', { fandoms: ['Harry Potter'], characters: ['Zed'] }),
    book('c', { userTags: ['angst'] }),
  ];
  it('dedupes case-insensitively, keeps first spelling, sorts', () => {
    expect(buildVocabulary(rs, 'fandoms')).toEqual(['harry potter', 'Naruto']);
    expect(buildVocabulary(rs, 'tags')).toEqual(['Angst', 'mine']);
    expect(buildVocabulary(rs, 'characters')).toEqual(['Zed']);
    expect(buildVocabulary(rs, 'relationships')).toEqual([]);
  });
  it('filters by kind', () => {
    expect(buildVocabulary(rs, 'tags', 'book')).toEqual(['angst']);
  });
});

describe('performance (§16)', () => {
  it('filters, searches and sorts 5,000 readables in under 100 ms', () => {
    const rs: Readable[] = Array.from({ length: 5000 }, (_, i) =>
      i % 2 === 0
        ? makeFanfic({ id: `f${i}`, title: `Fic ${i}`, wordCount: i * 10, fandoms: ['Naruto'], ao3Tags: ['Angst', 'Fluff'], summary: 'a long summary of text '.repeat(10) })
        : makeBook({ id: `b${i}`, title: `Book ${i}`, totalUnits: i, userTags: ['x'] }),
    );
    const notes = Object.fromEntries(rs.slice(0, 500).map((r) => [r.id, [{ body: 'some note body' }]]));
    const f = F({ status: ['want_to_read'], excludeTags: ['nope'], search: 'summary "long summary" note', sortBy: 'length' });
    const prefs: ContentPreferences = { hiddenWarnings: ['Underage'], hiddenRatings: ['explicit'] };
    expect(applyFilters(rs, notes, f, prefs).items.length).toBeGreaterThan(0);
    // Best of 5 after the warm-up above, so shared CI runners measure the code, not scheduler noise.
    const times = Array.from({ length: 5 }, () => {
      const start = performance.now();
      applyFilters(rs, notes, f, prefs);
      return performance.now() - start;
    });
    expect(Math.min(...times)).toBeLessThan(100);
  });
});
