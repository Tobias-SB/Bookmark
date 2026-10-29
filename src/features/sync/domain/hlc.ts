import { appError } from '@/shared/types/errors';

// Hybrid logical clock (spec §9.2): "<wall-ms, 15 digits>:<counter, 5 digits>:<deviceId>".
// Fixed-width fields make plain string comparison a total order, with the device id breaking ties.

export const GENESIS_HLC = '000000000000000:00000:00000000-0000-0000-0000-000000000000';

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 5;
const MAX_WALL = 10 ** WALL_DIGITS - 1;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;
const HLC_PATTERN = /^(\d{15}):(\d{5}):([^:]+)$/;

interface HlcParts {
  wall: number;
  counter: number;
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
  if (!/^[^:]+$/.test(deviceId)) throw appError('validation', 'Device id must be non-empty and contain no colon');
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

/** Next clock after seeing `remote` while merging, so this device never falls behind clocks it has seen. */
export function hlcReceive(last: string | null, remote: string, wallMs: number, deviceId: string): string {
  const wall = sanitizeWall(wallMs);
  const theirs = parseHlc(remote);
  const ours = last === null ? { wall: -1, counter: -1 } : parseHlc(last);
  const maxWall = Math.max(wall, ours.wall, theirs.wall);
  const counter =
    maxWall === ours.wall && maxWall === theirs.wall
      ? Math.max(ours.counter, theirs.counter) + 1
      : maxWall === ours.wall
        ? ours.counter + 1
        : maxWall === theirs.wall
          ? theirs.counter + 1
          : 0;
  return formatHlc({ wall: maxWall, counter }, deviceId);
}
