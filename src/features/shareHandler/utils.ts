// src/features/shareHandler/utils.ts
// Shared presentation helpers for the share handler feature.

/** Formats a word count as "1.2K words" or "840 words". Returns null for null input. */
export function formatWordCount(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n >= 1000 ? `${Math.round(n / 1000)}K words` : `${n} words`;
}

/**
 * Builds a chapter/word-count summary string for display in the share sheet.
 * Examples: "12 chapters · 45K words", "1 chapter", "30K words".
 * Returns null when both inputs are absent.
 */
export function buildChapterSummary(
  availableChapters: number | null | undefined,
  wordCount: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (availableChapters != null) {
    parts.push(availableChapters === 1 ? '1 chapter' : `${availableChapters} chapters`);
  }
  const wc = formatWordCount(wordCount);
  if (wc) parts.push(wc);
  return parts.length > 0 ? parts.join(' · ') : null;
}
