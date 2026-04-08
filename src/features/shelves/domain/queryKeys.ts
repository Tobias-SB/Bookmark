// src/features/shelves/domain/queryKeys.ts
// TanStack Query key factory for the shelves feature.

export const shelfKeys = {
  all:    ['shelves'] as const,
  lists:  () => ['shelves', 'list'] as const,
  detail: (id: string) => ['shelves', 'detail', id] as const,
  items:  (shelfId: string) => ['shelves', 'items', shelfId] as const,
} as const;
