import * as fc from 'fast-check';

import { isAppError } from '@/shared/types/errors';

import { hlcReceive, hlcTick } from '../hlc';
import { mergeRows, pickCanonical, type SyncRow } from '../merge';

// Readable clocks: c(5, 'a') => "000000000000005:00000:a".
const c = (wall: number, device = 'a') => `${String(wall).padStart(15, '0')}:00000:${device}`;

function row(partial: Partial<SyncRow>): SyncRow {
  return { id: 'r1', values: {}, fieldClocks: {}, updatedHlc: c(0), deletedAt: null, ...partial };
}

describe('mergeRows: fields (rule 1)', () => {
  it('keeps each field from the side with the higher clock', () => {
    const local = row({ values: { title: 'Old', progress: 9 }, fieldClocks: { title: c(1), progress: c(5) }, updatedHlc: c(5) });
    const remote = row({ values: { title: 'New', progress: 2 }, fieldClocks: { title: c(3, 'b'), progress: c(2, 'b') }, updatedHlc: c(3, 'b') });
    expect(mergeRows(local, remote)).toEqual({
      row: row({ values: { title: 'New', progress: 9 }, fieldClocks: { title: c(3, 'b'), progress: c(5) }, updatedHlc: c(5) }),
      restored: false,
    });
  });

  it('keeps a field present on only one side', () => {
    const local = row({ values: { title: 'T' }, fieldClocks: { title: c(1) }, updatedHlc: c(1) });
    const remote = row({ values: { notes: 'n' }, fieldClocks: { notes: c(2, 'b') }, updatedHlc: c(2, 'b') });
    expect(mergeRows(local, remote).row.values).toEqual({ title: 'T', notes: 'n' });
  });

  it('breaks an equal-clock conflict by the larger JSON value, in both directions', () => {
    const a = row({ values: { title: 'Alpha' }, fieldClocks: { title: c(4) }, updatedHlc: c(4) });
    const b = row({ values: { title: 'Beta' }, fieldClocks: { title: c(4) }, updatedHlc: c(4) });
    expect(mergeRows(a, b).row.values.title).toBe('Beta');
    expect(mergeRows(b, a).row.values.title).toBe('Beta');
  });

  it('treats a "__proto__" key from a file as plain data', () => {
    const remote = row({ values: JSON.parse('{"__proto__": {"polluted": true}}'), fieldClocks: JSON.parse('{"__proto__": "000000000000001:00000:b"}'), updatedHlc: c(1, 'b') });
    const merged = mergeRows(row({}), remote).row;
    expect(Object.hasOwn(merged.values, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(merged.values)).toBe(Object.prototype);
    expect(Object.hasOwn(merged.fieldClocks, '__proto__')).toBe(true);
  });

  it('ignores inherited keys such as "constructor"', () => {
    const merged = mergeRows(row({ values: { title: 'T' }, fieldClocks: { title: c(1) }, updatedHlc: c(1) }), row({})).row;
    expect(merged.values).toEqual({ title: 'T' });
  });

  it('rejects two different rows with an AppError', () => {
    let error: unknown;
    try {
      mergeRows(row({ id: 'a' }), row({ id: 'b' }));
    } catch (e) {
      error = e;
    }
    expect(isAppError(error)).toBe(true);
  });
});

describe('mergeRows: deletes (rule 2)', () => {
  const live = row({ values: { title: 'T' }, fieldClocks: { title: c(1) }, updatedHlc: c(1) });
  const deletedAt = '2026-10-01T00:00:00.000Z';

  it('deletes when the delete clock is higher than every field clock', () => {
    const tombstone = { ...live, updatedHlc: c(5, 'b'), deletedAt };
    expect(mergeRows(live, tombstone)).toEqual({ row: tombstone, restored: false });
    expect(mergeRows(tombstone, live)).toEqual({ row: tombstone, restored: false });
  });

  it('keeps a tombstone whose write also stamped a field with the delete clock', () => {
    const tombstone = row({ values: { title: 'T', updatedAt: deletedAt }, fieldClocks: { title: c(1), updatedAt: c(5) }, updatedHlc: c(5), deletedAt });
    expect(mergeRows(tombstone, live).row.deletedAt).toBe(deletedAt);
  });

  it('restores a local tombstone when another device edited after the delete, and says so', () => {
    const tombstone = { ...live, updatedHlc: c(5), deletedAt };
    const edited = row({ values: { title: 'Edited' }, fieldClocks: { title: c(7, 'b') }, updatedHlc: c(7, 'b') });
    expect(mergeRows(tombstone, edited)).toEqual({ row: edited, restored: true });
  });

  it('keeps the local row live when it was edited after a remote delete', () => {
    const tombstone = { ...live, updatedHlc: c(5, 'b'), deletedAt };
    const edited = row({ values: { title: 'Edited' }, fieldClocks: { title: c(7) }, updatedHlc: c(7) });
    expect(mergeRows(edited, tombstone)).toEqual({ row: edited, restored: false });
  });

  it('restores when another device undid the delete later', () => {
    const tombstone = { ...live, updatedHlc: c(5), deletedAt };
    const undone = { ...live, updatedHlc: c(6, 'b') };
    expect(mergeRows(tombstone, undone)).toEqual({ row: undone, restored: true });
  });

  it('deletes again when the delete comes after a restore', () => {
    const undone = { ...live, updatedHlc: c(6, 'b') };
    const deletedAgain = { ...live, updatedHlc: c(8), deletedAt };
    expect(mergeRows(undone, deletedAgain).row.deletedAt).toBe(deletedAt);
  });

  it('treats a malformed tombstone with a newer field clock as live', () => {
    const malformed = row({ values: { title: 'T' }, fieldClocks: { title: c(9) }, updatedHlc: c(5), deletedAt });
    expect(mergeRows(malformed, row({}))).toEqual({
      row: row({ values: { title: 'T' }, fieldClocks: { title: c(9) }, updatedHlc: c(9) }),
      restored: true,
    });
  });

  it('breaks an equal delete-clock conflict deterministically', () => {
    const a = { ...live, updatedHlc: c(5), deletedAt };
    const b = { ...live, updatedHlc: c(5), deletedAt: null };
    expect(mergeRows(a, b).row).toEqual(mergeRows(b, a).row);
  });
});

describe('pickCanonical (rule 3)', () => {
  it('chooses the earlier createdAt', () => {
    const early = { id: 'z', createdAt: '2025-01-01T00:00:00.000Z' };
    const late = { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' };
    expect(pickCanonical(early, late)).toEqual({ canonicalId: 'z', aliasId: 'a' });
    expect(pickCanonical(late, early)).toEqual({ canonicalId: 'z', aliasId: 'a' });
  });

  it('breaks a createdAt tie by the lower id', () => {
    const a = { id: 'a', createdAt: '2025-01-01T00:00:00.000Z' };
    const b = { id: 'b', createdAt: '2025-01-01T00:00:00.000Z' };
    expect(pickCanonical(a, b)).toEqual({ canonicalId: 'a', aliasId: 'b' });
    expect(pickCanonical(b, a)).toEqual({ canonicalId: 'a', aliasId: 'b' });
  });
});

// ---- properties (spec §9.1, §16) ----

// Small pools force equal clocks and equal values, including the "bug" ties of rule 1, and malformed rows.
const clockArb = fc.constantFrom(c(1), c(2), c(2, 'b'), c(3, 'c'));
const valueArb = fc.constantFrom<unknown>('x', 'y', 1, 2, null, { a: 1 }, ['l']);
const arbitraryRow: fc.Arbitrary<SyncRow> = fc.record({
  id: fc.constant('r1'),
  values: fc.record({ title: valueArb, progress: valueArb }, { requiredKeys: [] }),
  fieldClocks: fc.record({ title: clockArb, progress: clockArb }, { requiredKeys: [] }),
  updatedHlc: clockArb,
  deletedAt: fc.constantFrom(null, '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
});

const merge = (a: SyncRow, b: SyncRow) => mergeRows(a, b).row;

describe('mergeRows properties on arbitrary rows', () => {
  it('is commutative', () => {
    fc.assert(fc.property(arbitraryRow, arbitraryRow, (a, b) => expect(merge(a, b)).toEqual(merge(b, a))));
  });

  it('is associative', () => {
    fc.assert(
      fc.property(arbitraryRow, arbitraryRow, arbitraryRow, (a, b, x) => expect(merge(merge(a, b), x)).toEqual(merge(a, merge(b, x)))),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(arbitraryRow, arbitraryRow, (a, b) => {
        const m = merge(a, b);
        expect(merge(m, m)).toEqual(m);
        expect(merge(m, a)).toEqual(m);
        expect(merge(m, b)).toEqual(m);
      }),
    );
  });
});

// Simulated devices: each holds its rows and its hlc_last, writing exactly as a repository would (spec §8.3, §9.2).
type DeviceId = 'a' | 'b' | 'c';
const DEVICES: DeviceId[] = ['a', 'b', 'c'];
const ROW_IDS = ['r1', 'r2'];

interface Device {
  hlc: string | null;
  rows: Map<string, SyncRow>;
}

type Op =
  | { kind: 'edit'; device: DeviceId; rowId: string; field: 'title' | 'progress'; value: number; wall: number }
  | { kind: 'delete' | 'restore'; device: DeviceId; rowId: string; wall: number }
  | { kind: 'send'; from: DeviceId; to: DeviceId; wall: number };

const deviceArb = fc.constantFrom<DeviceId>(...DEVICES);
const wallArb = fc.integer({ min: 1, max: 20 }); // narrow range: walls repeat and go backwards
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('edit' as const), device: deviceArb, rowId: fc.constantFrom(...ROW_IDS), field: fc.constantFrom('title' as const, 'progress' as const), value: fc.integer({ min: 0, max: 3 }), wall: wallArb }),
  fc.record({ kind: fc.constantFrom('delete' as const, 'restore' as const), device: deviceArb, rowId: fc.constantFrom(...ROW_IDS), wall: wallArb }),
  fc.record({ kind: fc.constant('send' as const), from: deviceArb, to: deviceArb, wall: wallArb }),
);

function newDevices(): Record<DeviceId, Device> {
  return { a: { hlc: null, rows: new Map() }, b: { hlc: null, rows: new Map() }, c: { hlc: null, rows: new Map() } };
}

function tick(device: Device, wall: number, id: DeviceId): string {
  device.hlc = hlcTick(device.hlc, wall, id);
  return device.hlc;
}

function receive(target: Device, source: Device, wall: number, id: DeviceId) {
  if (source.hlc !== null) target.hlc = hlcReceive(target.hlc, source.hlc, wall, id);
  for (const [rowId, theirs] of source.rows) {
    const ours = target.rows.get(rowId);
    target.rows.set(rowId, ours ? mergeRows(ours, theirs).row : theirs);
  }
}

function apply(devices: Record<DeviceId, Device>, op: Op) {
  if (op.kind === 'send') {
    if (op.from !== op.to) receive(devices[op.to], devices[op.from], op.wall, op.to);
    return;
  }
  const device = devices[op.device];
  const existing = device.rows.get(op.rowId);
  if (op.kind === 'edit') {
    const t = tick(device, op.wall, op.device);
    const base = existing ?? row({ id: op.rowId });
    device.rows.set(op.rowId, { ...base, values: { ...base.values, [op.field]: op.value }, fieldClocks: { ...base.fieldClocks, [op.field]: t }, updatedHlc: t });
  } else if (existing && (op.kind === 'delete') === (existing.deletedAt === null)) {
    const t = tick(device, op.wall, op.device);
    device.rows.set(op.rowId, { ...existing, updatedHlc: t, deletedAt: op.kind === 'delete' ? `wall-${op.wall}` : null });
  }
}

const snapshot = (device: Device) => [...device.rows.entries()].sort(([x], [y]) => (x < y ? -1 : 1));

const PAIRS: [DeviceId, DeviceId][] = DEVICES.flatMap((from) => DEVICES.filter((to) => to !== from).map((to): [DeviceId, DeviceId] => [from, to]));

describe('mergeRows properties on three simulated devices', () => {
  it('all devices converge after exchanging files in any order', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), fc.shuffledSubarray(PAIRS, { minLength: PAIRS.length }), wallArb, (ops, order, wall) => {
        const devices = newDevices();
        for (const op of ops) apply(devices, op);
        // Each device sends to every other once; any order suffices because merge is a join.
        for (const [from, to] of order) receive(devices[to], devices[from], wall, to);
        expect(snapshot(devices.b)).toEqual(snapshot(devices.a));
        expect(snapshot(devices.c)).toEqual(snapshot(devices.a));
      }),
    );
  });

  it('device clocks never fall behind any clock they have stored', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), (ops) => {
        const devices = newDevices();
        for (const op of ops) apply(devices, op);
        for (const device of Object.values(devices)) {
          for (const stored of device.rows.values()) expect(device.hlc !== null && device.hlc >= stored.updatedHlc).toBe(true);
        }
      }),
    );
  });

  it('merging device states is commutative, associative and idempotent', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 40 }), fc.constantFrom(...ROW_IDS), (ops, rowId) => {
        const devices = newDevices();
        for (const op of ops) apply(devices, op);
        const [a, b, x] = DEVICES.map((id) => devices[id].rows.get(rowId) ?? row({ id: rowId }));
        expect(merge(a, b)).toEqual(merge(b, a));
        expect(merge(merge(a, b), x)).toEqual(merge(a, merge(b, x)));
        expect(merge(a, a)).toEqual(a);
      }),
    );
  });
});
