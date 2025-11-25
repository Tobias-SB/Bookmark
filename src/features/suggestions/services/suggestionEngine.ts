// src/features/suggestions/services/suggestionEngine.ts
import type { ReadableItem } from '@src/features/readables/types';
import type { MoodTag } from '@src/features/moods/types';
import type { SuggestionResult } from '@src/store/useUiStore';

export interface SuggestionFilters {
  includeBooks: boolean;
  includeFanfic: boolean;
  minWordCount?: number | null;
  maxWordCount?: number | null;
}

export interface SuggestionContext {
  moodTags: MoodTag[];
  filters: SuggestionFilters;
}

interface ScoredCandidate {
  item: ReadableItem;
  score: number;
  reason: string;
}

/**
 * Compute an approximate "length" in words for an item.
 * - For fanfic we use the explicit wordCount where available.
 * - For books we approximate via pageCount * 300 if pageCount exists.
 */
function getApproxWordCount(item: ReadableItem): number | null {
  if (item.type === 'fanfic') {
    return item.wordCount ?? null;
  }

  // Rough heuristic: 300 words per page if we have a pageCount.
  if (item.type === 'book' && item.pageCount != null) {
    return item.pageCount * 300;
  }

  return null;
}

/**
 * Return true if the item passes all type + length filters.
 */
function passesFilters(item: ReadableItem, filters: SuggestionFilters): boolean {
  if (item.type === 'book' && !filters.includeBooks) return false;
  if (item.type === 'fanfic' && !filters.includeFanfic) return false;

  const approxWords = getApproxWordCount(item);
  if (approxWords == null) {
    // If we don't know the length, we let it through unless filters are very strict.
    return true;
  }

  if (filters.minWordCount != null && approxWords < filters.minWordCount) {
    return false;
  }
  if (filters.maxWordCount != null && approxWords > filters.maxWordCount) {
    return false;
  }

  return true;
}

/**
 * Score a readable item given the current context.
 * Higher score = more likely to be picked.
 */
function scoreItem(item: ReadableItem, context: SuggestionContext): ScoredCandidate | null {
  const { moodTags, filters } = context;

  if (!passesFilters(item, filters)) {
    return null;
  }

  const selectedMoods = new Set(moodTags);
  const moodOverlapCount = item.moodTags.filter((tag) => selectedMoods.has(tag)).length;

  // Mood score:
  // - If moods are selected, each overlapping tag is worth 10 points.
  // - If no moods selected, moodScore = 0 (we fall back to priority).
  const moodScore = moodTags.length > 0 ? moodOverlapCount * 10 : 0;

  // Priority score: priority is 1–5, we weight it a bit.
  const priorityScore = item.priority * 5;

  // Small type bias if the user allows both:
  let typeScore = 0;
  if (filters.includeBooks && filters.includeFanfic) {
    typeScore = item.type === 'book' ? 2 : 3; // tiny nudge for fanfic by default
  }

  const baseScore = moodScore + priorityScore + typeScore;

  // Ensure minimum weight so it can still be picked.
  const score = baseScore > 0 ? baseScore : 1;

  const reasonParts: string[] = [];

  if (moodTags.length === 0) {
    reasonParts.push('No mood selected, using priority and filters');
  } else if (moodOverlapCount > 0) {
    reasonParts.push(`Matches ${moodOverlapCount} of your selected mood tag(s)`);
  } else {
    reasonParts.push('Does not match your selected mood tags but fits your filters');
  }

  reasonParts.push(`Priority ${item.priority}`);

  if (item.type === 'book') {
    reasonParts.push('Book');
  } else {
    reasonParts.push('Fanfic');
  }

  const approxWords = getApproxWordCount(item);
  if (approxWords != null) {
    if (filters.minWordCount != null || filters.maxWordCount != null) {
      reasonParts.push('Within your length range');
    } else {
      reasonParts.push(`Approx. ${approxWords.toLocaleString()} words`);
    }
  }

  const reason = reasonParts.join('. ') + '.';

  return { item, score, reason };
}

/**
 * Weighted random pick from a list of scored candidates.
 */
function pickWeightedRandom(candidates: ScoredCandidate[]): ScoredCandidate | null {
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((sum, c) => sum + c.score, 0);
  if (totalWeight <= 0) {
    // All scores are zero or negative (shouldn't happen with our scoring),
    // fallback to uniform random.
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  let threshold = Math.random() * totalWeight;
  for (const candidate of candidates) {
    if (threshold < candidate.score) {
      return candidate;
    }
    threshold -= candidate.score;
  }

  // Fallback, should be unreachable.
  return candidates[candidates.length - 1];
}

/**
 * Main suggestion engine entrypoint.
 * Takes a list of readables and a context, returns the chosen suggestion
 * or null if no viable items exist.
 */
export function runSuggestionEngine(
  items: ReadableItem[],
  context: SuggestionContext,
): SuggestionResult | null {
  const scored: ScoredCandidate[] = [];

  for (const item of items) {
    const scoredCandidate = scoreItem(item, context);
    if (scoredCandidate) {
      scored.push(scoredCandidate);
    }
  }

  const picked = pickWeightedRandom(scored);
  if (!picked) {
    return null;
  }

  const { item, score, reason } = picked;
  const result: SuggestionResult = { item, score, reason };
  return result;
}
