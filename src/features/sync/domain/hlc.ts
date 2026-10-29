import { appError } from '@/shared/types/errors';

// Hybrid logical clock (spec §9.2): "<wall-ms, 15 digits>:<counter, 5 digits>:<deviceId>".
// Fixed-width fields make plain string comparison a total order, with the device id breaking ties.

export const GENESIS_HLC = '000000000000000:00000:00000000-0000-0000-0000-000000000000';

// A remote clock more than a day ahead is a broken or hostile device; accepting it would drag ours forward for good.
export const MAX_REMOTE_DRIFT_MS = 24 * 60 * 60 * 1000;

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 5;
const MAX_WALL = 10 ** WALL_DIGITS - 1;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;
// Device ids are randomUUID() values (spec §8.7).
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HLC_PATTERN = /^([0-9]{15}):([0-9]{5}):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const NIL_DEVICE = GENESIS_HLC.slice(WALL_DIGITS + COUNTER_DIGITS + 2);

interface HlcParts {
  wall: number;
  counter: number;
}

/** The HLC grammar, for reuse by sync-file validation. */
export function isHlc(value: string): boolean {
  return HLC_PATTERN.test(value);
}

function parseHlc(value: string): HlcParts {
  const match = HLC_PATTERN.exec(value);
  if (!match) throw appError('parse', `Invalid HLC: ${value.slice(0, 80)}`);
  return { wall: Number(match[1]), counter: Number(match[2]) };
}

// A broken or negative wall clock must never produce a malformed clock string.
function sanitizeWall(wallMs: number): number {
  return Number.isFinite(wallMs) ? Math.min(MAX_WALL, Math.max(0, Math.floor(wallMs))) : 0;
}

function formatHlc({ wall, counter }: HlcParts, deviceId: string): string {
  // The nil UUID is reserved for GENESIS_HLC, so GENESIS_HLC stays below every real clock.
  if (!UUID_PATTERN.test(deviceId) || deviceId === NIL_DEVICE) throw appError('validation', 'Device id must be a UUID');
  // Counter overflow borrows the next millisecond so the clock still moves strictly forward.
  const parts = counter > MAX_COUNTER ? { wall: wall + 1, counter: 0 } : { wall, counter };
  if (parts.wall > MAX_WALL) throw appError('validation', 'HLC wall time out of range');
  return `${String(parts.wall).padStart(WALL_DIGITS, '0')}:${String(parts.counter).padStart(COUNTER_DIGITS, '0')}:${deviceId}`;
}

/** Next clock for a local write. `last` is the persisted `hlc_last`, or null before the first write. */
export function hlcTick(last: string | null, wallMs: number, deviceId: string): string {
  const wall = sanitizeWall(wallMs);
  if (last === null) return formatHlc({ wall, counter: 0 }, deviceId);
  const prev = parseHlc(last);
  return formatHlc(wall > prev.wall ? { wall, counter: 0 } : { wall: prev.wall, counter: prev.counter + 1 }, deviceId);
}

// A remote clock at the wall ceiling, or far ahead of us, would leave this device unable to tick again.
function assertAcceptable(theirs: HlcParts, wall: number): void {
  if (theirs.wall >= MAX_WALL) throw appError('validation', 'Remote clock is at the end of its range');
  if (theirs.wall - wall > MAX_REMOTE_DRIFT_MS) throw appError('validation', 'Remote clock is too far ahead of this device');
}

function receivedCounter(maxWall: number, ours: HlcParts, theirs: HlcParts): number {
  if (maxWall === ours.wall && maxWall === theirs.wall) return Math.max(ours.counter, theirs.counter) + 1;
  if (maxWall === ours.wall) return ours.counter + 1;
  if (maxWall === theirs.wall) return theirs.counter + 1;
  return 0;
}

/** Next clock after seeing `remote` while merging, so this device never falls behind clocks it has seen. */
export function hlcReceive(last: string | null, remote: string, wallMs: number, deviceId: string): string {
  const wall = sanitizeWall(wallMs);
  const theirs = parseHlc(remote);
  assertAcceptable(theirs, wall);
  const ours = last === null ? { wall: -1, counter: -1 } : parseHlc(last);
  const maxWall = Math.max(wall, ours.wall, theirs.wall);
  return formatHlc({ wall: maxWall, counter: receivedCounter(maxWall, ours, theirs) }, deviceId);
}
