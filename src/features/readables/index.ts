// src/features/readables/index.ts
// Public API for the readables feature.
// All inter-feature imports must go through this file — never from internal paths.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  Readable,
  ReadableKind,
  ReadableStatus,
  ProgressUnit,
  SourceType,
  ReadableFilters,
} from './domain/readable';

export { READABLE_STATUSES } from './domain/readable';

// ── Query key factory ─────────────────────────────────────────────────────────
export { readableKeys } from './domain/queryKeys';

// ── Repository — input types and functions ────────────────────────────────────
// ReadableRow and mapper internals are intentionally not exported.
export type {
  CreateReadableInput,
  UpdateReadableInput,
} from './data/readableRepository';

export {
  listReadables,
  getReadableById,
  createReadable,
  updateReadable,
  deleteReadable,
} from './data/readableRepository';
