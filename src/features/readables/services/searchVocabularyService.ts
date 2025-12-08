// src/features/readables/services/searchVocabularyService.ts
import type { ReadableItem } from '../types';
import type { MoodTag } from '@src/features/moods/types';
import { getMoodDefinition } from '@src/features/moods/types';
import { normalizeForSearch } from './libraryFilterService';

export type SearchTokenSource =
  | 'mood'
  | 'fandom'
  | 'relationship'
  | 'character'
  | 'ao3-tag'
  | 'warning'
  | 'genre'
  | 'author';

export interface SearchToken {
  id: string;
  label: string;
  normalized: string;
  source: SearchTokenSource;
  frequency: number;
}

function makeKey(source: SearchTokenSource, normalized: string): string {
  return `${source}::${normalized}`;
}

function addToken(
  map: Map<string, SearchToken>,
  rawLabel: string | null | undefined,
  source: SearchTokenSource,
) {
  if (!rawLabel) return;
  const trimmed = rawLabel.trim();
  if (!trimmed) return;

  const normalized = normalizeForSearch(trimmed);
  if (!normalized) return;

  const key = makeKey(source, normalized);
  const existing = map.get(key);

  if (existing) {
    existing.frequency += 1;
    return;
  }

  map.set(key, {
    id: key,
    label: trimmed,
    normalized,
    source,
    frequency: 1,
  });
}

/**
 * Build a search vocabulary from the current library:
 * - Mood tags (using human-friendly labels)
 * - Fanfic: fandoms, relationships, characters, ao3Tags, warnings
 * - Books: genres
 * - All: authors
 */
export function buildSearchVocabularyFromReadables(readables: ReadableItem[]): SearchToken[] {
  const map = new Map<string, SearchToken>();

  for (const item of readables) {
    // Mood tags → use mood definitions for nice labels
    if (Array.isArray(item.moodTags)) {
      for (const mood of item.moodTags as MoodTag[]) {
        const def = getMoodDefinition(mood);
        addToken(map, def.label, 'mood');
      }
    }

    if (item.type === 'fanfic') {
      if (Array.isArray(item.fandoms)) {
        for (const fandom of item.fandoms) {
          addToken(map, fandom, 'fandom');
        }
      }
      if (Array.isArray(item.relationships)) {
        for (const rel of item.relationships) {
          addToken(map, rel, 'relationship');
        }
      }
      if (Array.isArray(item.characters)) {
        for (const char of item.characters) {
          addToken(map, char, 'character');
        }
      }
      if (Array.isArray(item.ao3Tags)) {
        for (const tag of item.ao3Tags) {
          addToken(map, tag, 'ao3-tag');
        }
      }
      if (Array.isArray(item.warnings)) {
        for (const w of item.warnings) {
          addToken(map, w, 'warning');
        }
      }
    }

    if (item.type === 'book') {
      if (Array.isArray(item.genres)) {
        for (const g of item.genres) {
          addToken(map, g, 'genre');
        }
      }
    }

    if (item.author) {
      addToken(map, item.author, 'author');
    }
  }

  return Array.from(map.values());
}
