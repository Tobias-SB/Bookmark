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
  AO3Rating,
  AuthorType,
} from './domain/readable';

export { READABLE_STATUSES, AO3_RATING_LABELS } from './domain/readable';

// ── Query key factory ─────────────────────────────────────────────────────────
export { readableKeys } from './domain/queryKeys';

// ── Repository — input types and functions ────────────────────────────────────
// ReadableRow and mapper internals are intentionally not exported.
export type {
  CreateReadableInput,
  UpdateReadableInput,
  RefreshMetadataInput,
} from './data/readableRepository';

export {
  listReadables,
  getReadableById,
  findReadableBySourceId,
  createReadable,
  updateReadable,
  deleteReadable,
  refreshReadableMetadata,
} from './data/readableRepository';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export type { UseReadablesResult } from './hooks/useReadables';
export { useReadables } from './hooks/useReadables';

export type { UseReadableResult } from './hooks/useReadable';
export { useReadable } from './hooks/useReadable';

export type { UseCreateReadableResult } from './hooks/useCreateReadable';
export { useCreateReadable } from './hooks/useCreateReadable';

export type { UseUpdateReadableResult, UpdateReadableVariables } from './hooks/useUpdateReadable';
export { useUpdateReadable } from './hooks/useUpdateReadable';

export type { UseDeleteReadableResult, DeleteReadableVariables } from './hooks/useDeleteReadable';
export { useDeleteReadable } from './hooks/useDeleteReadable';

export type { UseRefreshReadableMetadataResult, RefreshResult } from './hooks/useRefreshReadableMetadata';
export { useRefreshReadableMetadata } from './hooks/useRefreshReadableMetadata';

export type { UseUpdateNotesResult } from './hooks/useUpdateNotes';
export { useUpdateNotes } from './hooks/useUpdateNotes';

export type { UseUpdateCoverResult, UpdateCoverInput } from './hooks/useUpdateCover';
export { useUpdateCover } from './hooks/useUpdateCover';

// ── Screens ───────────────────────────────────────────────────────────────────
export { LibraryScreen } from './ui/LibraryScreen';
export { ReadableDetailScreen } from './ui/ReadableDetailScreen';
export { AddEditScreen } from './ui/AddEditScreen';
export { QuickAddScreen } from './ui/QuickAddScreen';
