// src/features/wipUpdates/services/summarizeWipUpdate.ts
// Generates a concise dot-separated summary string for a WipUpdate card.
// Used in the Updates screen list view (before the card is expanded).
//
// Priority order: statusReverted → isComplete → chapters → totalUnits →
//   wordCount → tags → relationships → archiveWarnings → seriesTotal

import type { WipUpdate } from '../domain/wipUpdate';

function plural(n: number, singular: string, pluralStr?: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralStr ?? singular + 's'}`;
}

export function summarizeWipUpdate(update: WipUpdate): string {
  const parts: string[] = [];

  // statusReverted: most visually prominent change
  if (update.statusReverted) {
    parts.push('reverted to reading');
  }

  // isComplete: false → true
  if (!update.previousIsComplete && update.fetchedIsComplete === true) {
    parts.push('marked complete');
  }

  // availableChapters: new chapters
  if (
    update.fetchedAvailableChapters !== null &&
    update.fetchedAvailableChapters !== update.previousAvailableChapters
  ) {
    const prev = update.previousAvailableChapters ?? 0;
    const diff = update.fetchedAvailableChapters - prev;
    if (diff > 0) {
      parts.push(`${plural(diff, 'new chapter')}`);
    } else {
      parts.push('chapters updated');
    }
  }

  // totalUnits changed
  if (
    update.fetchedTotalUnits !== null &&
    update.fetchedTotalUnits !== update.previousTotalUnits
  ) {
    parts.push('total updated');
  }

  // wordCount changed
  if (
    update.fetchedWordCount !== null &&
    update.fetchedWordCount !== update.previousWordCount
  ) {
    parts.push('word count updated');
  }

  // tags added / removed
  const addedTags = update.fetchedTags.filter(t => !update.previousTags.includes(t));
  const removedTags = update.previousTags.filter(t => !update.fetchedTags.includes(t));
  if (addedTags.length > 0) parts.push(`${plural(addedTags.length, 'tag')} added`);
  if (removedTags.length > 0) parts.push(`${plural(removedTags.length, 'tag')} removed`);

  // relationships changed
  const relChanged =
    update.fetchedRelationships.some(r => !update.previousRelationships.includes(r)) ||
    update.previousRelationships.some(r => !update.fetchedRelationships.includes(r));
  if (relChanged) parts.push('relationships updated');

  // archiveWarnings changed
  const warnChanged =
    update.fetchedArchiveWarnings.some(w => !update.previousArchiveWarnings.includes(w)) ||
    update.previousArchiveWarnings.some(w => !update.fetchedArchiveWarnings.includes(w));
  if (warnChanged) parts.push('warnings updated');

  // seriesTotal changed
  if (
    update.fetchedSeriesTotal !== null &&
    update.fetchedSeriesTotal !== update.previousSeriesTotal
  ) {
    parts.push('series updated');
  }

  return parts.length > 0 ? parts.join(' · ') : 'No changes detected';
}
