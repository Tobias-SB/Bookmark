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

  it('stores -0 as 0 so both merge orders agree', () => {
    const a = row({ values: { progress: -0 }, fieldClocks: { progress: c(4) }, updatedHlc: c(4) });
    const b = row({ values: { progress: 0 }, fieldClocks: { progress: c(4) }, updatedHlc: c(4) });
    expect(Object.is(mergeRows(a, b).row.values.progress, 0)).toBe(true);
    expect(Object.is(mergeRows(b, a).row.values.progress, 0)).toBe(true);
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
  const deletedAt = '2026-10-01T00:00:00.000Z';
  // Device A's copy: created at t1 (creation stamps the life clock with "not deleted").
  const created = row({
    values: { title: 'T', status: 'reading', userTags: [] },
    fieldClocks: { title: c(1), status: c(1), userTags: c(1), deletedAt: c(1) },
    updatedHlc: c(1),
  });
  // Writes the given fields with one clock; `life` says whether the write stamps fieldClocks.deletedAt.
  const write = (r: SyncRow, clock: string, fields: Record<string, unknown>, life: { deletedAt: string | null } | null): SyncRow => ({
    ...r,
    values: { ...r.values, ...fields },
    fieldClocks: { ...r.fieldClocks, ...Object.fromEntries(Object.keys(fields).map((k) => [k, clock])), ...(life ? { deletedAt: clock } : {}) },
    updatedHlc: clock,
    deletedAt: life ? life.deletedAt : r.deletedAt,
  });
  const tombstoneAt5 = write(created, c(5), {}, { deletedAt });

  it('deletes when the delete is the newest life event, in both orders', () => {
    expect(mergeRows(created, tombstoneAt5)).toEqual({ row: tombstoneAt5, restored: false });
    expect(mergeRows(tombstoneAt5, created)).toEqual({ row: tombstoneAt5, restored: false });
  });

  it('stays deleted after an AO3 update with a status write at t6 on another device, taking its values', () => {
    const ao3Update = write(created, c(6, 'b'), { title: 'T2', availableChapters: 2, status: 'reading' }, null);
    for (const [local, remote] of [[tombstoneAt5, ao3Update], [ao3Update, tombstoneAt5]]) {
      const merged = mergeRows(local, remote).row;
      expect(merged.deletedAt).toBe(deletedAt);
      expect(merged.values).toEqual({ title: 'T2', status: 'reading', userTags: [], availableChapters: 2 });
      expect(merged.fieldClocks.deletedAt).toBe(c(5));
      expect(merged.updatedHlc).toBe(c(6, 'b'));
    }
    expect(mergeRows(tombstoneAt5, ao3Update).restored).toBe(false);
  });

  it('restores after a user edit at t6 on another device, and says so', () => {
    const edited = write(created, c(6, 'b'), { userTags: ['comfort'] }, { deletedAt: null });
    expect(mergeRows(tombstoneAt5, edited)).toEqual({ row: edited, restored: true });
    expect(mergeRows(edited, tombstoneAt5)).toEqual({ row: edited, restored: false });
  });

  it('restores after an undo at t6 on another device', () => {
    const undone = write(tombstoneAt5, c(6, 'b'), {}, { deletedAt: null });
    expect(mergeRows(tombstoneAt5, undone)).toEqual({ row: undone, restored: true });
  });

  it('stays deleted when the user edit at t4 came before the delete at t5', () => {
    const edited = write(created, c(4, 'b'), { userTags: ['comfort'] }, { deletedAt: null });
    const merged = mergeRows(tombstoneAt5, edited);
    expect(merged.row.deletedAt).toBe(deletedAt);
    expect(merged.row.values.userTags).toEqual(['comfort']);
    expect(merged.restored).toBe(false);
  });

  it('deletes again when a delete comes after an undo', () => {
    const undone = write(tombstoneAt5, c(6, 'b'), {}, { deletedAt: null });
    const deletedAgain = write(undone, c(8), {}, { deletedAt });
    expect(mergeRows(undone, deletedAgain).row).toEqual(deletedAgain);
  });

  it('merges rows with no life clock on either side by the deterministic tie-break', () => {
    const live = row({ values: { title: 'T' }, fieldClocks: { title: c(1) }, updatedHlc: c(1) });
    const tombstone = { ...live, updatedHlc: c(5), deletedAt };
    const forward = mergeRows(tombstone, live);
    expect(forward.row).toEqual(mergeRows(live, tombstone).row);
    expect(forward.row.fieldClocks).toEqual({ title: c(1) });
    expect(forward.row.updatedHlc).toBe(c(5));
    // The larger JSON value wins: "null" sorts above a quoted date.
    expect(forward.row.deletedAt).toBeNull();
    expect(forward.restored).toBe(false);
  });

  it('never reports a restore when a tombstone merges with itself', () => {
    expect(mergeRows(tombstoneAt5, tombstoneAt5)).toEqual({ row: tombstoneAt5, restored: false });
  });

  it('drops a stray deletedAt from values and raises updatedHlc to cover every clock', () => {
    const odd = row({ values: { title: 'T', deletedAt: 'x' }, fieldClocks: { title: c(9) }, updatedHlc: c(2) });
    expect(mergeRows(odd, odd).row).toEqual(row({ values: { title: 'T' }, fieldClocks: { title: c(9) }, updatedHlc: c(9) }));
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

// Small pools force equal clocks and equal values, including the "bug" ties of rule 1. Rows are sparse:
// any field, its clock or the life clock may be missing on either side.
const clockArb = fc.constantFrom(c(1), c(2), c(2, 'b'), c(3, 'c'));
const valueArb = fc.constantFrom<unknown>('x', 'y', 1, 2, 0, -0, null, { a: 1 }, ['l']);
const arbitraryRow: fc.Arbitrary<SyncRow> = fc.record({
  id: fc.constant('r1'),
  values: fc.record({ title: valueArb, progress: valueArb, deletedAt: valueArb }, { requiredKeys: [] }),
  fieldClocks: fc.record({ title: clockArb, progress: clockArb, deletedAt: clockArb }, { requiredKeys: [] }),
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
  | { kind: 'edit'; device: DeviceId; rowId: string; field: 'userTags' | 'progress'; value: number; wall: number }
  | { kind: 'ao3'; device: DeviceId; rowId: string; field: 'title' | 'availableChapters' | 'status'; value: number; wall: number }
  | { kind: 'delete' | 'restore'; device: DeviceId; rowId: string; wall: number }
  | { kind: 'send'; from: DeviceId; to: DeviceId; wall: number };

const deviceArb = fc.constantFrom<DeviceId>(...DEVICES);
const rowIdArb = fc.constantFrom(...ROW_IDS);
const smallInt = fc.integer({ min: 0, max: 3 });
const wallArb = fc.integer({ min: 1, max: 20 }); // narrow range: walls repeat and go backwards
// An AO3 update, including its statusPatch write: system writes that never stamp the life clock.
const ao3OpArb: fc.Arbitrary<Op> = fc.record({ kind: fc.constant('ao3' as const), device: deviceArb, rowId: rowIdArb, field: fc.constantFrom('title' as const, 'availableChapters' as const, 'status' as const), value: smallInt, wall: wallArb });
const sendOpArb: fc.Arbitrary<Op> = fc.record({ kind: fc.constant('send' as const), from: deviceArb, to: deviceArb, wall: wallArb });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('edit' as const), device: deviceArb, rowId: rowIdArb, field: fc.constantFrom('userTags' as const, 'progress' as const), value: smallInt, wall: wallArb }),
  ao3OpArb,
  fc.record({ kind: fc.constantFrom('delete' as const, 'restore' as const), device: deviceArb, rowId: rowIdArb, wall: wallArb }),
  sendOpArb,
);

function newDevices(): Record<DeviceId, Device> {
  return { a: { hlc: null, rows: new Map() }, b: { hlc: null, rows: new Map() }, c: { hlc: null, rows: new Map() } };
}

const DEVICE_UUIDS: Record<DeviceId, string> = {
  a: 'aaaaaaaa-0000-4000-8000-000000000000',
  b: 'bbbbbbbb-0000-4000-8000-000000000000',
  c: 'cccccccc-0000-4000-8000-000000000000',
};

function tick(device: Device, wall: number, id: DeviceId): string {
  device.hlc = hlcTick(device.hlc, wall, DEVICE_UUIDS[id]);
  return device.hlc;
}

function receive(target: Device, source: Device, wall: number, id: DeviceId) {
  if (source.hlc !== null) target.hlc = hlcReceive(target.hlc, source.hlc, wall, DEVICE_UUIDS[id]);
  for (const [rowId, theirs] of source.rows) {
    const ours = target.rows.get(rowId);
    target.rows.set(rowId, ours ? mergeRows(ours, theirs).row : theirs);
  }
}

// One repository write: stamps the given fields with one tick; `life` also stamps fieldClocks.deletedAt.
function write(device: Device, id: DeviceId, base: SyncRow, fields: Record<string, unknown>, wall: number, life?: { deletedAt: string | null }) {
  const t = tick(device, wall, id);
  const clocks = Object.fromEntries([...Object.keys(fields), ...(life ? ['deletedAt'] : [])].map((key) => [key, t]));
  const deletedAt = life ? life.deletedAt : base.deletedAt;
  device.rows.set(base.id, { ...base, values: { ...base.values, ...fields }, fieldClocks: { ...base.fieldClocks, ...clocks }, updatedHlc: t, deletedAt });
}

function apply(devices: Record<DeviceId, Device>, op: Op) {
  if (op.kind === 'send') {
    if (op.from !== op.to) receive(devices[op.to], devices[op.from], op.wall, op.to);
    return;
  }
  const device = devices[op.device];
  const existing = device.rows.get(op.rowId);
  if (op.kind === 'ao3') {
    if (existing) write(device, op.device, existing, { [op.field]: op.value }, op.wall);
  } else if (op.kind === 'edit') {
    // Creating or editing a live row writes "not deleted"; tombstoned rows are hidden, so not editable.
    if (!existing || existing.deletedAt === null) write(device, op.device, existing ?? row({ id: op.rowId }), { [op.field]: op.value }, op.wall, { deletedAt: null });
  } else if (existing && (op.kind === 'delete') === (existing.deletedAt === null)) {
    write(device, op.device, existing, {}, op.wall, { deletedAt: op.kind === 'delete' ? `wall-${op.wall}` : null });
  }
}

function exchangeAll(devices: Record<DeviceId, Device>, order: [DeviceId, DeviceId][], wall: number) {
  for (const [from, to] of order) receive(devices[to], devices[from], wall, to);
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
        exchangeAll(devices, order, wall);
        expect(snapshot(devices.b)).toEqual(snapshot(devices.a));
        expect(snapshot(devices.c)).toEqual(snapshot(devices.a));
      }),
    );
  });

  it('AO3 updates (including status writes) made after a delete never bring the row back', () => {
    fc.assert(
      fc.property(
        fc.array(opArb, { maxLength: 30 }),
        deviceArb,
        rowIdArb,
        fc.array(fc.oneof(ao3OpArb, sendOpArb), { maxLength: 20 }),
        fc.shuffledSubarray(PAIRS, { minLength: PAIRS.length }),
        wallArb,
        (before, deleter, rowId, after, order, wall) => {
          const devices = newDevices();
          for (const op of before) apply(devices, op);
          // The deleter has seen every earlier write, so its delete is the newest life event.
          exchangeAll(devices, order, wall);
          apply(devices, { kind: 'restore', device: deleter, rowId, wall });
          apply(devices, { kind: 'edit', device: deleter, rowId, field: 'progress', value: 1, wall });
          apply(devices, { kind: 'delete', device: deleter, rowId, wall });
          // The others may or may not have seen the delete before their AO3 updates.
          for (const op of after) apply(devices, op);
          exchangeAll(devices, order, wall);
          for (const id of DEVICES) expect(devices[id].rows.get(rowId)?.deletedAt).toBe(`wall-${wall}`);
        },
      ),
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
