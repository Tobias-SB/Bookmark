// src/features/wipUpdates/index.ts
// Public API for the wipUpdates feature.
// All inter-feature imports must go through this file — never from internal paths.

// ── Domain types ──────────────────────────────────────────────────────────────
export type { WipUpdate, WipUpdateStatus, CreateWipUpdateInput } from './domain/wipUpdate';
export { wipUpdateKeys } from './domain/queryKeys';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export type { UseWipUpdatesResult } from './hooks/useWipUpdates';
export { useWipUpdates } from './hooks/useWipUpdates';

export { useUnreadWipUpdateCount } from './hooks/useUnreadWipUpdateCount';

export type { UseCheckWipUpdatesResult } from './hooks/useCheckWipUpdates';
export { useCheckWipUpdates } from './hooks/useCheckWipUpdates';

export type { UseMarkWipUpdateReadResult } from './hooks/useMarkWipUpdateRead';
export { useMarkWipUpdateRead } from './hooks/useMarkWipUpdateRead';

export type { UseMarkAllWipUpdatesReadResult } from './hooks/useMarkAllWipUpdatesRead';
export { useMarkAllWipUpdatesRead } from './hooks/useMarkAllWipUpdatesRead';

export type { UseDeleteWipUpdateResult } from './hooks/useDeleteWipUpdate';
export { useDeleteWipUpdate } from './hooks/useDeleteWipUpdate';

export type { UseClearWipUpdatesResult, ClearMode } from './hooks/useClearWipUpdates';
export { useClearWipUpdates } from './hooks/useClearWipUpdates';

// ── Screen ────────────────────────────────────────────────────────────────────
export { UpdatesScreen } from './ui/UpdatesScreen';
