// src/db/schema/moods.schema.ts
export type MoodTag =
  | 'cozy'
  | 'dark'
  | 'hopeful'
  | 'wholesome'
  | 'fast-paced'
  | 'slow-burn'
  | 'light'
  | 'dense'
  | 'mind-bending'
  | 'romantic'
  | 'funny'
  | 'epic'
  | 'mysterious';

export interface MoodProfileRow {
  id: string;
  label: string;
  tags_json: string; // JSON-encoded MoodTag[]
  created_at: string;
  updated_at: string;
}

export interface MoodProfileTagRow {
  id: string;
  mood_profile_id: string;
  mood_tag: MoodTag;
}
