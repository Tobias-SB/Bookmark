import { appError, type AppError } from '@/shared/types/errors';
import {
  isFinalPosition,
  progressCeiling,
  type Readable,
  type ReadablePatch,
  type ReadableStatus,
} from './readable';

export type ProgressChange =
  | { status: ReadableStatus }
  | { progressCurrent: number | null }
  | { increment: 1 }
  | { startReread: true };

// Mirrors Omit<ReadingEvent, 'id'> (spec §6.4); ReadingEvent itself is not in the codebase yet.
export interface NewReadingEvent {
  readableId: string;
  type: 'started' | 'finished' | 'dnf' | 'reread_started';
  at: string;
  wordsAtEvent: number | null;
  unitsAtEvent: number | null;
}

export type ProgressResult =
  | { ok: true; patch: ReadablePatch; events: NewReadingEvent[] }
  | { ok: false; error: AppError };

interface Draft {
  status: ReadableStatus;
  progressCurrent: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  readCount: number;
  events: NewReadingEvent['type'][];
}

const fail = (message: string): ProgressResult => ({ ok: false, error: appError('validation', message) });

function draftOf(r: Readable): Draft {
  return {
    status: r.status,
    progressCurrent: r.progressCurrent,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    readCount: r.readCount,
    events: [],
  };
}

function validate(r: Readable, progress: number | null): string | null {
  if (r.kind === 'fanfic' && r.availableChapters !== null && r.totalUnits !== null && r.availableChapters > r.totalUnits) {
    return 'availableChapters exceeds totalUnits';
  }
  if (progress === null) return null;
  if (!Number.isInteger(progress) || progress < 0) return 'progress must be a non-negative integer';
  if (r.kind === 'book' && r.progressUnit === 'percent' && progress > 100) return 'percent must be 0-100';
  const ceiling = progressCeiling(r);
  if (ceiling !== null && progress > ceiling) return 'progress exceeds the known ceiling';
  return null;
}

function markStarted(d: Draft, now: string): void {
  d.startedAt ??= now;
  d.events.push('started');
}

function markFinished(d: Draft, now: string): void {
  d.status = 'completed';
  d.finishedAt = now;
  d.readCount += 1;
  d.events.push('finished');
}

function applyProgress(r: Readable, d: Draft, progress: number | null, now: string): void {
  d.progressCurrent = progress;
  if (progress !== null && progress > 0 && d.status === 'want_to_read') {
    d.status = 'reading';
    markStarted(d, now);
  }
  if (progress !== null && d.status !== 'completed' && isFinalPosition(r, progress)) {
    markFinished(d, now);
  } else if (d.status === 'completed' && (progress === null || !isFinalPosition(r, progress))) {
    d.status = 'reading';
  }
}

// What "completed" snaps progress to: the known ceiling, or what is posted for a WIP.
function completionTarget(r: Readable): number | null {
  if (r.kind === 'book') return progressCeiling(r);
  return r.isComplete ? r.totalUnits : r.availableChapters;
}

function applyStatus(r: Readable, d: Draft, status: ReadableStatus, now: string): void {
  if (status === d.status) return;
  const from = d.status;
  d.status = status;
  if (status === 'completed') {
    d.progressCurrent = completionTarget(r) ?? d.progressCurrent;
    markFinished(d, now);
  } else if (status === 'dnf') {
    d.events.push('dnf');
  } else if (status === 'want_to_read') {
    d.progressCurrent = null;
  } else if (from === 'want_to_read') {
    markStarted(d, now);
  }
}

function applyReread(d: Draft, now: string): void {
  d.status = 'reading';
  d.progressCurrent = null;
  d.startedAt = now;
  d.events.push('reread_started');
}

function toResult(r: Readable, d: Draft, now: string): ProgressResult {
  const patch: ReadablePatch = {
    kind: r.kind,
    status: d.status,
    progressCurrent: d.progressCurrent,
    startedAt: d.startedAt,
    finishedAt: d.finishedAt,
    readCount: d.readCount,
    lastReadAt: now,
  };
  const events = d.events.map((type) => ({
    readableId: r.id,
    type,
    at: now,
    wordsAtEvent: r.kind === 'fanfic' ? r.wordCount : null,
    unitsAtEvent: r.totalUnits,
  }));
  return { ok: true, patch, events };
}

export function applyProgressChange(current: Readable, change: ProgressChange, now: string): ProgressResult {
  const d = draftOf(current);
  if ('startReread' in change) {
    if (current.status !== 'completed' && current.status !== 'dnf') return fail('re-read starts from completed or dnf');
    applyReread(d, now);
    return toResult(current, d, now);
  }
  if ('status' in change) {
    applyStatus(current, d, change.status, now);
    return toResult(current, d, now);
  }
  const target = 'increment' in change ? (current.progressCurrent ?? 0) + 1 : change.progressCurrent;
  const problem = validate(current, target);
  if (problem !== null) return fail(problem);
  applyProgress(current, d, target, now);
  return toResult(current, d, now);
}
