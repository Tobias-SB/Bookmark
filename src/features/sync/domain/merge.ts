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
  /** The local row was a tombstone and the merged row is live (spec §9.3 rule 2 summary). */
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

// `updatedHlc` is the row's delete or restore clock when it exceeds every field clock. A tombstone whose
// field clocks are newer than its delete is live (rule 2); `updatedHlc` is raised to cover every field clock.
function normalise(row: SyncRow): SyncRow {
  const fieldMax = maxClock(Object.values(row.fieldClocks), ABSENT);
  if (fieldMax <= row.updatedHlc) return row;
  return { ...row, updatedHlc: fieldMax, deletedAt: null };
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
    if (value !== undefined) values.push([key, value]);
    if (clock !== ABSENT) clocks.push([key, clock]);
  }
  // fromEntries defines own properties, so a "__proto__" key from an untrusted file stays plain data.
  return { values: Object.fromEntries(values), fieldClocks: Object.fromEntries(clocks) };
}

/**
 * Field-wise last-writer-wins merge of two versions of one synced row (spec §9.3).
 * Deletion is a register on `updatedHlc`: a tombstone stays deleted only while no field or restore clock
 * is newer than its delete. Commutative, associative and idempotent on `row`.
 */
export function mergeRows(local: SyncRow, remote: SyncRow): MergeResult {
  if (local.id !== remote.id) throw appError('validation', 'mergeRows needs two versions of the same row');
  const a = normalise(local);
  const b = normalise(remote);
  const winner = beats(a.updatedHlc, a.deletedAt, b.updatedHlc, b.deletedAt) ? a : b;
  const row: SyncRow = { id: local.id, ...mergeFields(a, b), updatedHlc: winner.updatedHlc, deletedAt: winner.deletedAt };
  return { row, restored: local.deletedAt !== null && row.deletedAt === null };
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
