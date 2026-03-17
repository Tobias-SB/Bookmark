// src/features/wipUpdates/hooks/useUnreadWipUpdateCount.ts
// Query hook — returns the count of unread WipUpdate records.
// Used by TabNavigator to drive the Updates tab badge.

import { useQuery } from '@tanstack/react-query';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { wipUpdateKeys } from '../domain/queryKeys';
import { listUnreadWipUpdates } from '../data/wipUpdateRepository';

export function useUnreadWipUpdateCount(): number {
  const db = useDatabase();

  const { data } = useQuery({
    queryKey: wipUpdateKeys.unreadCount(),
    queryFn: async () => {
      const unread = await listUnreadWipUpdates(db);
      return unread.length;
    },
  });

  return data ?? 0;
}
