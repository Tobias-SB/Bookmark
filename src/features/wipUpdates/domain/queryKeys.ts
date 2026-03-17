// src/features/wipUpdates/domain/queryKeys.ts
// Query key factory for wipUpdates queries.
// All hooks and mutations in this feature must use wipUpdateKeys —
// no inline key literals.
// Invalidating wipUpdateKeys.all invalidates all list, count, and detail queries.

export const wipUpdateKeys = {
  all: ['wipUpdates'] as const,
  lists: () => ['wipUpdates', 'list'] as const,
  unreadCount: () => ['wipUpdates', 'unreadCount'] as const,
  detail: (id: string) => ['wipUpdates', 'detail', id] as const,
} as const;
