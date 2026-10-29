import { AO3_OWNED_FIELDS } from '@/features/ao3/domain/ao3Snapshot';
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

const AO3_OWNED: ReadonlySet<string> = new Set(AO3_OWNED_FIELDS);

// kind and sourceType are immutable (spec §6.2), so every version of a row agrees on this.
function isAo3Fanfic(values: Record<string, unknown>): boolean {
  return own(values, 'kind') === 'fanfic' && own(values, 'sourceType') === 'ao3';
}

// `updatedHlc` is raised to cover every field clock. Outside AO3 fanfic, `updatedHlc` is the delete or
// restore clock, so a tombstone whose field clocks are newer than its delete is live (rule 2).
function normalise(row: SyncRow, ao3: boolean): SyncRow {
  const fieldMax = maxClock(Object.values(row.fieldClocks), ABSENT);
  if (fieldMax <= row.updatedHlc) return row;
  return { ...row, updatedHlc: fieldMax, deletedAt: ao3 ? row.deletedAt : null };
}

// The clock that decides delete versus live. On AO3 fanfic only user-owned field clocks count, because an
// AO3 update is not an edit (it never restores); deletes and undos stamp the user-owned `updatedAt` there.
function lifeClock(row: SyncRow, ao3: boolean): string {
  if (!ao3) return row.updatedHlc;
  return maxClock(Object.entries(row.fieldClocks).filter(([key]) => !AO3_OWNED.has(key)).map(([, clock]) => clock), ABSENT);
}

function mergeFields(a: SyncRow, b: SyncRow): Pick<SyncRow, 'values' | 'fieldClocks'> {
  const keys = new Set([...Object.keys(a.values), ...Object.keys(a.fieldClocks), ...Object.keys(b.values), ...Object.keys(b.fieldClocks)]);
  const values: [string, unknown][] = [];
  const clocks: [string, string][] = [];
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
 * Deletion is a register on the life clock (`lifeClock`): a tombstone stays deleted only while no edit or
 * undo is newer than its delete; on AO3 fanfic, AO3-owned field clocks are not edits. Commutative and
 * associative on `row`; `mergeRows(x, x).row` is `x` normalised (equal to `x` for well-formed rows), and
 * merging a merged row again changes nothing.
 */
export function mergeRows(local: SyncRow, remote: SyncRow): MergeResult {
  if (local.id !== remote.id) throw appError('validation', 'mergeRows needs two versions of the same row');
  const ao3 = isAo3Fanfic(local.values) || isAo3Fanfic(remote.values);
  const a = normalise(local, ao3);
  const b = normalise(remote, ao3);
  const lifeA = lifeClock(a, ao3);
  const winner = beats(lifeA, a.deletedAt, lifeClock(b, ao3), b.deletedAt) ? a : b;
  const updatedHlc = a.updatedHlc > b.updatedHlc ? a.updatedHlc : b.updatedHlc;
  const row: SyncRow = { id: local.id, ...mergeFields(a, b), updatedHlc, deletedAt: winner.deletedAt };
  // Restored by the other side only: a malformed local tombstone that normalises to live is not news.
  const restored = local.deletedAt !== null && row.deletedAt === null && lifeClock(row, ao3) !== lifeA;
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
