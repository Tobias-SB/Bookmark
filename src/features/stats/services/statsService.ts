// src/features/stats/services/statsService.ts
import { readableRepository } from '@src/features/readables/services/readableRepository';
import type { ReadableItem } from '@src/features/readables/types';

export interface MoodStats {
  moodTag: string;
  count: number;
}

export interface TypeStats {
  type: 'book' | 'fanfic';
  count: number;
}

export interface StatsOverview {
  total: number;
  byMood: MoodStats[];
  byType: TypeStats[];
}

export async function getStatsOverview(): Promise<StatsOverview> {
  const items: ReadableItem[] = await readableRepository.getAllToRead();
  const total = items.length;

  const moodCounts = new Map<string, number>();
  const typeCounts = new Map<'book' | 'fanfic', number>([
    ['book', 0],
    ['fanfic', 0],
  ]);

  for (const item of items) {
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    for (const tag of item.moodTags) {
      moodCounts.set(tag, (moodCounts.get(tag) ?? 0) + 1);
    }
  }

  const byMood: MoodStats[] = Array.from(moodCounts.entries()).map(([moodTag, count]) => ({
    moodTag,
    count,
  }));

  const byType: TypeStats[] = Array.from(typeCounts.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return { total, byMood, byType };
}
