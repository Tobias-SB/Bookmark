// src/features/readables/domain/queryKeys.ts
// §13 — Query key factory. All hooks and mutations must use readableKeys —
// no inline key literals anywhere in the codebase.
// Invalidating readableKeys.all invalidates both list and detail queries.

import type { ReadableFilters } from './readable';

export const readableKeys = {
  all: ['readables'] as const,
  list: (filters?: ReadableFilters) => ['readables', 'list', filters ?? {}] as const,
  detail: (id: string) => ['readables', 'detail', id] as const,
} as const;
