// src/features/shelves/index.ts
// Public API for the shelves feature.
// ShelfRow and ShelfReadableRow are internal to the data layer and are not exported.

// ── Domain types ───────────────────────────────────────────────────────────────
export type { Shelf, ShelfReadable } from './domain/shelf';

// ── Query key factory ──────────────────────────────────────────────────────────
export { shelfKeys } from './domain/queryKeys';

// ── Repository ─────────────────────────────────────────────────────────────────
export type { CreateShelfInput, UpdateShelfInput } from './data/shelfRepository';
export {
  listShelves,
  getShelfById,
  createShelf,
  updateShelf,
  deleteShelf,
  listShelfReadables,
  addToShelf,
  removeFromShelf,
  reorderShelf,
} from './data/shelfRepository';

// ── Hooks ──────────────────────────────────────────────────────────────────────
export { useShelves } from './hooks/useShelves';
export { useShelfReadables } from './hooks/useShelfReadables';
export { useCreateShelf } from './hooks/useCreateShelf';
export { useUpdateShelf } from './hooks/useUpdateShelf';
export { useDeleteShelf } from './hooks/useDeleteShelf';
export { useAddToShelf } from './hooks/useAddToShelf';
export { useRemoveFromShelf } from './hooks/useRemoveFromShelf';

// ── UI components ──────────────────────────────────────────────────────────────
export { ShelfCard } from './ui/ShelfCard';
export { ShelvesSection } from './ui/ShelvesSection';

// ── Result types ───────────────────────────────────────────────────────────────
export type { UseShelvesResult } from './hooks/useShelves';
export type { UseShelfReadablesResult } from './hooks/useShelfReadables';
export type { AddToShelfVariables } from './hooks/useAddToShelf';
export type { RemoveFromShelfVariables } from './hooks/useRemoveFromShelf';
export type { UpdateShelfVariables } from './hooks/useUpdateShelf';
