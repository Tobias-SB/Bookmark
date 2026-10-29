import { array, assert, nat, property } from 'fast-check';
import { fractionalKeyBetween, fractionalKeysBetween } from '../fractionalIndex';

const isSorted = (keys: string[]) => keys.every((k, i) => i === 0 || (keys[i - 1] ?? '') < k);

describe('fractionalKeyBetween', () => {
  it('starts at the seed key', () => {
    expect(fractionalKeyBetween(null, null)).toBe('a0');
  });

  it('places keys before, after and between the seed', () => {
    const before = fractionalKeyBetween(null, 'a0');
    const after = fractionalKeyBetween('a0', null);
    const between = fractionalKeyBetween('a0', after);
    expect(before < 'a0' && 'a0' < after).toBe(true);
    expect('a0' < between && between < after).toBe(true);
  });

  it('crosses integer boundaries', () => {
    const k = fractionalKeyBetween('az', 'b00');
    expect('az' < k && k < 'b00').toBe(true);
    expect(fractionalKeyBetween('Zz', 'a0') > 'Zz').toBe(true);
  });

  it.each([
    ['a1', 'a0'],
    ['a0', 'a0'],
    ['a1', 'a1'],
  ])('throws when a >= b (%s, %s)', (a, b) => {
    expect(() => fractionalKeyBetween(a, b)).toThrow();
  });

  it.each(['', '!', 'a', 'a00', 'a0!', 'A' + '0'.repeat(26), '0a'])('throws on malformed key %p', (bad) => {
    expect(() => fractionalKeyBetween(bad, null)).toThrow();
    expect(() => fractionalKeyBetween(null, bad)).toThrow();
  });

  it('keeps keys short over 1,000 appends', () => {
    let last = 'a0';
    for (let i = 0; i < 1000; i++) last = fractionalKeyBetween(last, null);
    expect(last.length).toBeLessThanOrEqual(5);
  });

  it('keeps keys short over 1,000 prepends', () => {
    let first = 'a0';
    for (let i = 0; i < 1000; i++) first = fractionalKeyBetween(null, first);
    expect(first.length).toBeLessThanOrEqual(5);
  });

  it('keeps keys bounded over 1,000 inserts between the same two neighbours', () => {
    const lo = 'a0';
    let hi = fractionalKeyBetween(lo, null);
    for (let i = 0; i < 1000; i++) {
      const k = fractionalKeyBetween(lo, hi);
      expect(lo < k && k < hi).toBe(true);
      hi = k;
    }
    expect(hi.length).toBeLessThanOrEqual(200);
  });

  it('keeps ordering over random insertion sequences', () => {
    assert(
      property(array(nat(), { maxLength: 200 }), (picks) => {
        const keys: string[] = [];
        for (const p of picks) {
          const slot = p % (keys.length + 1);
          const k = fractionalKeyBetween(keys[slot - 1] ?? null, keys[slot] ?? null);
          keys.splice(slot, 0, k);
        }
        return isSorted(keys);
      }),
    );
  });
});

describe('fractionalKeysBetween', () => {
  it('returns n ascending keys strictly inside the bounds', () => {
    const bounds: [string | null, string | null][] = [
      [null, null],
      ['a0', null],
      [null, 'a0'],
      ['a0', 'a1'],
      ['a0', 'a0V'],
    ];
    for (const [a, b] of bounds) {
      for (const n of [0, 1, 2, 5, 40]) {
        const keys = fractionalKeysBetween(a, b, n);
        expect(keys).toHaveLength(n);
        expect(isSorted([...(a ? [a] : []), ...keys, ...(b ? [b] : [])])).toBe(true);
      }
    }
  });

  it('rejects an invalid count', () => {
    expect(() => fractionalKeysBetween(null, null, -1)).toThrow();
    expect(() => fractionalKeysBetween(null, null, 1.5)).toThrow();
  });
});
