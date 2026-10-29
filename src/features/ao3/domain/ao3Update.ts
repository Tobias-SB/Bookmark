import type { Fanfic, FanficPatch, Readable, ReadablePatch } from '../../readables/domain/readable';
import { AO3_OWNED_FIELDS, type Ao3Change, type Ao3OwnedField, type Ao3Snapshot } from './ao3Snapshot';

type Ao3OwnedValues = Pick<Fanfic, Ao3OwnedField>;
type Severity = Ao3Change['severity'];

export interface Ao3UpdatePlan {
  changed: boolean; // false → write nothing
  patch: FanficPatch; // AO3-owned fields only
  changes: Ao3Change[]; // safety first, then progress, then info
  statusPatch: { status: 'reading' } | null;
  statusReverted: boolean;
  suggestMarkFinished: boolean; // work became complete and the reader is on the last chapter
}

const SEVERITY_RANK: Record<Severity, number> = { safety: 0, progress: 1, info: 2 };

function severityOf(field: Ao3OwnedField): Severity {
  if (field === 'archiveWarnings' || field === 'rating') return 'safety';
  if (field === 'availableChapters' || field === 'totalUnits' || field === 'isComplete') return 'progress';
  return 'info';
}

// undefined = the snapshot did not include the field, so the stored value stays.
function incomingValues(current: Fanfic, s: Ao3Snapshot): Partial<Ao3OwnedValues> {
  const values: Partial<Ao3OwnedValues> = {
    title: s.title, authors: s.authors, authorType: s.authorType, summary: s.summary,
    fandoms: s.fandoms, relationships: s.relationships, characters: s.characters,
    categories: s.categories, ao3Tags: s.ao3Tags, rating: s.rating,
    archiveWarnings: s.archiveWarnings, availableChapters: s.availableChapters,
    totalUnits: s.totalUnits, wordCount: s.wordCount, isComplete: s.isComplete,
    publishedAt: s.publishedAt, ao3UpdatedAt: s.ao3UpdatedAt,
  };
  if (s.series) {
    const seriesKey = `ao3:${s.series.seriesId}`;
    values.seriesKey = seriesKey;
    values.seriesName = s.series.name;
    values.seriesPart = s.series.part;
    // An unknown total keeps the stored one only while the work stays in the same series.
    values.seriesTotal = s.series.total !== undefined ? s.series.total
      : seriesKey === current.seriesKey ? undefined : null;
  }
  return values;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function difference(a: string[], b: string[]): string[] {
  const exclude = new Set(b);
  return [...new Set(a)].filter((item) => !exclude.has(item));
}

function diffField<K extends Ao3OwnedField>(
  field: K, before: Ao3OwnedValues[K], after: Ao3OwnedValues[K] | undefined, patch: Partial<Ao3OwnedValues>,
): Ao3Change | null {
  if (after === undefined) return null;
  const severity = severityOf(field);
  if (isStringArray(before) && isStringArray(after)) {
    const added = difference(after, before);
    const removed = difference(before, after);
    if (added.length === 0 && removed.length === 0) return null; // arrays compare as sets
    patch[field] = after;
    return { field, before, after, added, removed, severity };
  }
  if (before === after) return null;
  patch[field] = after;
  return { field, before, after, severity };
}

// Pure: AO3 updates only ever write AO3-owned fields (§6.5, §7.5).
export function planAo3Update(current: Fanfic, incoming: Ao3Snapshot, now: string): Ao3UpdatePlan {
  void now; // part of the §7.5 signature; no owned field depends on it yet
  const values = incomingValues(current, incoming);
  const owned: Partial<Ao3OwnedValues> = {};
  const changes: Ao3Change[] = [];
  for (const field of AO3_OWNED_FIELDS) {
    const change = diffField(field, current[field], values[field], owned);
    if (change) changes.push(change);
  }
  changes.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const progress = current.progressCurrent ?? 0;
  const available = incoming.availableChapters ?? current.availableChapters;
  const statusReverted = current.status === 'completed'
    && incoming.availableChapters !== undefined && incoming.availableChapters > progress;
  // shortcut: "on the last chapter" is inlined here; dedupe with §6.6 readingStateOf once it lands.
  const suggestMarkFinished = !current.isComplete && incoming.isComplete === true
    && current.status === 'reading' && available !== null && progress >= available;

  return {
    changed: changes.length > 0 || statusReverted,
    patch: { kind: 'fanfic', ...owned },
    changes,
    statusPatch: statusReverted ? { status: 'reading' } : null,
    statusReverted,
    suggestMarkFinished,
  };
}

// User patches on AO3-sourced fanfic lose AO3-owned fields; manual fanfic and books keep everything.
export function stripAo3OwnedFields(readable: Readable, patch: ReadablePatch): ReadablePatch {
  if (readable.kind !== 'fanfic' || readable.sourceType !== 'ao3' || patch.kind !== 'fanfic') return patch;
  const stripped: FanficPatch = { ...patch };
  for (const field of AO3_OWNED_FIELDS) delete stripped[field];
  return stripped;
}
