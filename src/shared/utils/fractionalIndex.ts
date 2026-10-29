// Fractional-index keys (base62, plain string comparison orders them). Integer head + fractional tail;
// the seed key 'a0' is the first key. Invalid input throws Error: it is a caller bug, not a runtime failure.
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const SMALLEST_INT = 'A' + '0'.repeat(26);
const LAST_DIGIT = DIGITS.charAt(BASE - 1);
export const MAX_KEY_LENGTH = 1024;

function digitValue(ch: string): number {
  const v = DIGITS.indexOf(ch);
  if (v < 0) throw new Error(`invalid fractional key digit: ${ch}`);
  return v;
}

function intLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 96 + 1;
  if (head >= 'A' && head <= 'Z') return 90 - head.charCodeAt(0) + 2;
  throw new Error(`invalid fractional key head: ${head}`);
}

function integerPart(key: string): string {
  const len = intLength(key.charAt(0));
  if (len > key.length) throw new Error(`invalid fractional key: ${key}`);
  return key.slice(0, len);
}

function validateKey(key: string): void {
  // Keys arrive in sync files; the cap stops a hostile key from exhausting the stack in midpoint.
  if (key.length > MAX_KEY_LENGTH) throw new Error('fractional key too long');
  if (key === SMALLEST_INT) throw new Error(`invalid fractional key: ${key}`);
  const frac = key.slice(integerPart(key).length);
  if (frac.endsWith('0')) throw new Error(`invalid fractional key: ${key}`);
  for (const ch of key) digitValue(ch);
}

// Midpoint of two fractional tails; b === null means "no upper bound".
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while (n < b.length && (a.charAt(n) || '0') === b.charAt(n)) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const lo = a ? digitValue(a.charAt(0)) : 0;
  const hi = b !== null ? digitValue(b.charAt(0)) : BASE;
  if (hi - lo > 1) return DIGITS.charAt(Math.round((lo + hi) / 2));
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS.charAt(lo) + midpoint(a.slice(1), null);
}

function incrementInteger(x: string): string | null {
  const head = x.charAt(0);
  const digs = x.slice(1).split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = digitValue(digs[i] ?? '') + 1;
    digs[i] = d === BASE ? '0' : DIGITS.charAt(d);
    carry = d === BASE;
  }
  if (!carry) return head + digs.join('');
  if (head === 'Z') return 'a0';
  if (head === 'z') return null;
  const h = String.fromCharCode(head.charCodeAt(0) + 1);
  if (h > 'a') digs.push('0');
  else digs.pop();
  return h + digs.join('');
}

function decrementInteger(x: string): string | null {
  const head = x.charAt(0);
  const digs = x.slice(1).split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = digitValue(digs[i] ?? '') - 1;
    digs[i] = d === -1 ? LAST_DIGIT : DIGITS.charAt(d);
    borrow = d === -1;
  }
  if (!borrow) return head + digs.join('');
  if (head === 'a') return 'Z' + LAST_DIGIT;
  if (head === 'A') return null;
  const h = String.fromCharCode(head.charCodeAt(0) - 1);
  if (h < 'Z') digs.push(LAST_DIGIT);
  else digs.pop();
  return h + digs.join('');
}

/** Returns a key k with a < k < b. null means unbounded; both null gives the seed 'a0'. */
export function fractionalKeyBetween(a: string | null, b: string | null): string {
  const key = keyBetween(a, b);
  if (key.length > MAX_KEY_LENGTH) throw new Error('fractional key too long');
  return key;
}

function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) validateKey(a);
  if (b !== null) validateKey(b);
  if (a !== null && b !== null && a >= b) throw new Error(`fractional keys out of order: ${a} >= ${b}`);
  if (a === null) {
    if (b === null) return 'a0';
    const ib = integerPart(b);
    if (ib === SMALLEST_INT) throw new Error('cannot go below the smallest fractional key');
    if (ib < b) return ib;
    const res = decrementInteger(ib);
    if (res === null || res === SMALLEST_INT) throw new Error('cannot go below the smallest key');
    return res;
  }
  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  if (b === null) {
    const i = incrementInteger(ia);
    return i === null ? ia + midpoint(fa, null) : i;
  }
  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);
  const i = incrementInteger(ia);
  if (i === null) throw new Error('cannot increment any further');
  return i < b ? i : ia + midpoint(fa, null);
}

/** Returns n ascending keys strictly between a and b, spread so lengths stay short. */
export function fractionalKeysBetween(a: string | null, b: string | null, n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid key count: ${n}`);
  if (n === 0) return [];
  if (n === 1) return [fractionalKeyBetween(a, b)];
  if (b === null) {
    let c = fractionalKeyBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i++) out.push((c = fractionalKeyBetween(c, b)));
    return out;
  }
  if (a === null) {
    let c = fractionalKeyBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i++) out.push((c = fractionalKeyBetween(a, c)));
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = fractionalKeyBetween(a, b);
  return [...fractionalKeysBetween(a, c, mid), c, ...fractionalKeysBetween(c, b, n - mid - 1)];
}
