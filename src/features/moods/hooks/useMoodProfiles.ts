// src/features/moods/hooks/useMoodProfiles.ts
import { useQuery } from '@tanstack/react-query';
import type { MoodProfile } from '../types';

/**
 * Placeholder implementation.
 * In a future iteration we could persist mood profiles in SQLite.
 */
async function fetchMoodProfiles(): Promise<MoodProfile[]> {
  return [];
}

export function useMoodProfiles() {
  return useQuery<MoodProfile[]>({
    queryKey: ['moodProfiles'],
    queryFn: fetchMoodProfiles,
  });
}
