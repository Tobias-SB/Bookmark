import type { MoodTag as DbMoodTag, MoodProfileRow } from '@src/db/schema/moods.schema';

export type MoodTag = DbMoodTag;

/**
 * Metadata for a mood tag.
 *
 * - `tag` is the canonical slug (string union, used in DB & filters)
 * - `label` is the human-facing name
 * - `description` can be used for tooltips/help text
 * - `icon` is an optional icon name (e.g. for react-native-paper or similar)
 * - `colorToken` is an optional theme token key (NOT a raw color)
 */
export interface MoodDefinition {
  tag: MoodTag;
  label: string;
  description?: string;
  icon?: string;
  colorToken?: string;
}

/**
 * All known mood definitions.
 *
 * NOTE:
 * - `tag` values MUST stay in sync with the MoodTag union from the DB schema.
 * - You can safely tweak labels/descriptions/icons without breaking data.
 */
export const MOOD_DEFINITIONS: MoodDefinition[] = [
  {
    tag: 'cozy',
    label: 'Cozy',
    description: 'Low-stakes, safe, comfortable vibes.',
    icon: 'tea',
    colorToken: 'mood.cozy',
  },
  {
    tag: 'dark',
    label: 'Dark',
    description: 'Heavier themes, darker tone.',
    icon: 'weather-night',
    colorToken: 'mood.dark',
  },
  {
    tag: 'hopeful',
    label: 'Hopeful',
    description: 'Uplifting tone, light at the end of the tunnel.',
    icon: 'white-balance-sunny',
    colorToken: 'mood.hopeful',
  },
  {
    tag: 'wholesome',
    label: 'Wholesome',
    description: 'Soft, kind, emotionally safe.',
    icon: 'heart',
    colorToken: 'mood.wholesome',
  },
  {
    tag: 'fast-paced',
    label: 'Fast paced',
    description: 'Quick-moving, lots of plot momentum.',
    icon: 'flash',
    colorToken: 'mood.fastPaced',
  },
  {
    tag: 'slow-burn',
    label: 'Slow burn',
    description: 'Gradual build-up, especially for relationships.',
    icon: 'fire',
    colorToken: 'mood.slowBurn',
  },
  {
    tag: 'light',
    label: 'Light',
    description: 'Easy to read, low emotional weight.',
    icon: 'weather-sunny',
    colorToken: 'mood.light',
  },
  {
    tag: 'dense',
    label: 'Dense',
    description: 'Complex, layered, or heavy on worldbuilding.',
    icon: 'book',
    colorToken: 'mood.dense',
  },
  {
    tag: 'mind-bending',
    label: 'Mind bending',
    description: 'Twisty, weird, or reality-bending.',
    icon: 'brain',
    colorToken: 'mood.mindBending',
  },
  {
    tag: 'romantic',
    label: 'Romantic',
    description: 'Romance-forward or relationship-focused.',
    icon: 'heart-outline',
    colorToken: 'mood.romantic',
  },
  {
    tag: 'funny',
    label: 'Funny',
    description: 'Humorous, comedic, or cracky.',
    icon: 'emoticon-happy-outline',
    colorToken: 'mood.funny',
  },
  {
    tag: 'epic',
    label: 'Epic',
    description: 'Big stakes, long arcs, or sweeping scope.',
    icon: 'sword-cross',
    colorToken: 'mood.epic',
  },
  {
    tag: 'mysterious',
    label: 'Mysterious',
    description: 'Mystery, investigation, or secrets.',
    icon: 'magnify',
    colorToken: 'mood.mysterious',
  },
  {
    tag: 'smut',
    label: 'Smut',
    description: 'Explicit, sex-forward, steamy vibes.',
    icon: 'lipstick',
    colorToken: 'mood.smut',
  },
];

/**
 * Convenience array of all mood tags (slugs).
 * This preserves the old ALL_MOOD_TAGS export shape so existing code keeps working.
 */
export const ALL_MOOD_TAGS: MoodTag[] = MOOD_DEFINITIONS.map((m) => m.tag);

/**
 * Lookup table for mood definitions by tag.
 */
export const MOOD_BY_TAG: Record<MoodTag, MoodDefinition> = MOOD_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.tag] = def;
    return acc;
  },
  {} as Record<MoodTag, MoodDefinition>,
);

/**
 * Fallback label for a mood slug if we somehow don’t have a definition.
 */
function prettifyMoodSlug(tag: string): string {
  return tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Safe accessor for a mood definition.
 * If a tag is missing from MOOD_DEFINITIONS, we return a minimal
 * definition so the UI still renders something sensible.
 */
export function getMoodDefinition(tag: MoodTag): MoodDefinition {
  const def = MOOD_BY_TAG[tag];
  if (def) return def;

  return {
    tag,
    label: prettifyMoodSlug(tag),
  };
}

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
