// src/features/moods/types.ts
import type { MoodTag as DbMoodTag, MoodProfileRow } from '@src/db/schema/moods.schema';

export type MoodTag = DbMoodTag;

export const ALL_MOOD_TAGS: MoodTag[] = [
  'cozy',
  'dark',
  'hopeful',
  'wholesome',
  'fast-paced',
  'slow-burn',
  'light',
  'dense',
  'mind-bending',
  'romantic',
  'funny',
  'epic',
  'mysterious',
];

export interface MoodProfile {
  id: string;
  label: string;
  tags: MoodTag[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Mapper from DB row to domain model.
 */
export function mapMoodProfileRowToDomain(row: MoodProfileRow): MoodProfile {
  const tags = JSON.parse(row.tags_json) as MoodTag[];
  return {
    id: row.id,
    label: row.label,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Mapper from domain model to DB row insert/update payload (without id timestamps).
 */
export function buildMoodProfileRowFromDomain(
  profile: Omit<MoodProfile, 'createdAt' | 'updatedAt'>,
): Omit<MoodProfileRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  const now = new Date().toISOString();
  return {
    id: profile.id,
    label: profile.label,
    tags_json: JSON.stringify(profile.tags),
    created_at: now,
    updated_at: now,
  };
}
