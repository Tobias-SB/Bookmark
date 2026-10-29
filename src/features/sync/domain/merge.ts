import { appError } from '@/shared/types/errors';

// Row shape in a `.bookmark` file (spec §9.4).
export interface SyncRow {
  id: string;
  values: Record<string, unknown>; // camelCase domain fields, without sync columns
  fieldClocks: Record<string, string>;
  updatedHlc: string;
  deletedAt: string | null;
}

export interface MergeResult {
  row: SyncRow;
  /** The local row was a tombstone and the other side brought it back (spec §9.3 rule 2 summary). */
  restored: boolean;
}

// Absent sorts below every value and every clock, including GENESIS_HLC.
const ABSENT = '';

function jsonKey(value: unknown): string {
  return value === undefined ? ABSENT : (JSON.stringify(value) ?? ABSENT);
}

function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

// Higher clock wins; equal clocks (a bug) fall back to the larger JSON value so every device agrees (rule 1).
function beats(clockA: string, valueA: unknown, clockB: string, valueB: unknown): boolean {
  if (clockA !== clockB) return clockA > clockB;
  return jsonKey(valueA) >= jsonKey(valueB);
}

function maxClock(clocks: Iterable<string>, floor: string): string {
  let max = floor;
  for (const clock of clocks) if (clock > max) max = clock;
  return max;
}

/**
 * The life clock: `fieldClocks.deletedAt` is the clock of the row's `deletedAt` value. Delete, undo and
 * every user edit stamp it (an edit writes "not deleted"); AO3 updates and other system writes never do.
 */
export const LIFE_CLOCK_KEY = 'deletedAt';

const lifeClock = (row: SyncRow): string => own(row.fieldClocks, LIFE_CLOCK_KEY) ?? ABSENT;

function mergeFields(a: SyncRow, b: SyncRow, lifeClockValue: string): Pick<SyncRow, 'values' | 'fieldClocks'> {
  const keys = new Set([...Object.keys(a.values), ...Object.keys(a.fieldClocks), ...Object.keys(b.values), ...Object.keys(b.fieldClocks)]);
  keys.delete(LIFE_CLOCK_KEY); // merged with SyncRow.deletedAt below; a stray values.deletedAt is dropped
  const values: [string, unknown][] = [];
  const clocks: [string, string][] = lifeClockValue === ABSENT ? [] : [[LIFE_CLOCK_KEY, lifeClockValue]];
  for (const key of keys) {
    const clockA = own(a.fieldClocks, key) ?? ABSENT;
    const clockB = own(b.fieldClocks, key) ?? ABSENT;
    const valueA = own(a.values, key);
    const valueB = own(b.values, key);
    const [clock, value] = beats(clockA, valueA, clockB, valueB) ? [clockA, valueA] : [clockB, valueB];
    // JSON cannot tell -0 from 0, so the tie-break treats them as equal; store 0 so both orders agree.
    if (value !== undefined) values.push([key, Object.is(value, -0) ? 0 : value]);
    if (clock !== ABSENT) clocks.push([key, clock]);
  }
  // fromEntries defines own properties, so a "__proto__" key from an untrusted file stays plain data.
  return { values: Object.fromEntries(values), fieldClocks: Object.fromEntries(clocks) };
}

/**
 * Field-wise last-writer-wins merge of two versions of one synced row (spec §9.3).
 * `deletedAt` is one more last-writer-wins field, clocked by `fieldClocks.deletedAt` (rule 2): a tombstone
 * stays deleted until a newer edit or undo. Other field values merge regardless of deleted state.
 * `updatedHlc` becomes the highest clock on either side. Commutative and associative on `row`;
 * `mergeRows(x, x).row` is `x` (with `updatedHlc` raised to cover its field clocks if it did not).
 */
export function mergeRows(local: SyncRow, remote: SyncRow): MergeResult {
  if (local.id !== remote.id) throw appError('validation', 'mergeRows needs two versions of the same row');
  const lifeLocal = lifeClock(local);
  const lifeRemote = lifeClock(remote);
  const winner = beats(lifeLocal, local.deletedAt, lifeRemote, remote.deletedAt) ? local : remote;
  const lifeMerged = winner === local ? lifeLocal : lifeRemote;
  const fields = mergeFields(local, remote, lifeMerged);
  const updatedHlc = maxClock(Object.values(fields.fieldClocks), local.updatedHlc > remote.updatedHlc ? local.updatedHlc : remote.updatedHlc);
  const row: SyncRow = { id: local.id, ...fields, updatedHlc, deletedAt: winner.deletedAt };
  // Restored by the other side only, so merging a tombstone with itself is never news.
  const restored = local.deletedAt !== null && row.deletedAt === null && lifeMerged !== lifeLocal;
  return { row, restored };
}

export interface CanonicalCandidate {
  id: string;
  createdAt: string;
}

/**
 * Duplicate AO3 works (same source, different ids, both live): the earlier `createdAt` is canonical,
 * ties go to the lower id (spec §9.3 rule 3). `createdAt` is ISO 8601 UTC, so string order is time order.
 */
export function pickCanonical(a: CanonicalCandidate, b: CanonicalCandidate): { canonicalId: string; aliasId: string } {
  const aFirst = a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : a.id <= b.id;
  return aFirst ? { canonicalId: a.id, aliasId: b.id } : { canonicalId: b.id, aliasId: a.id };
}
