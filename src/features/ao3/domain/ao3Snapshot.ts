import type { AO3Rating, AuthorType, FanficPatch } from '../../readables/domain/readable';

// Changed only by AO3 updates on a fanfic with sourceType 'ao3'.
export const AO3_OWNED_FIELDS = [
  'title', 'authors', 'authorType', 'summary', 'fandoms', 'relationships', 'characters',
  'categories', 'ao3Tags', 'rating', 'archiveWarnings', 'availableChapters', 'totalUnits',
  'wordCount', 'isComplete', 'publishedAt', 'ao3UpdatedAt',
  'seriesKey', 'seriesName', 'seriesPart', 'seriesTotal',
] as const satisfies readonly (keyof FanficPatch)[];

export type Ao3OwnedField = (typeof AO3_OWNED_FIELDS)[number];

// undefined = the source did not include the field; null or [] = present and empty.
export interface Ao3Snapshot {
  workId: string;
  url: string; // canonical https://archiveofourown.org/works/<id>
  title?: string;
  authors?: string[];
  authorType?: AuthorType;
  summary?: string | null;
  fandoms?: string[];
  relationships?: string[];
  characters?: string[];
  categories?: string[];
  ao3Tags?: string[];
  rating?: AO3Rating | null;
  archiveWarnings?: string[];
  availableChapters?: number;
  totalUnits?: number | null; // '?' → null
  wordCount?: number | null;
  isComplete?: boolean;
  publishedAt?: string | null;
  ao3UpdatedAt?: string | null;
  series?: { seriesId: string; name: string; part: number; total?: number | null } | null; // null = in no series
  hasAbandonedTag?: boolean; // any freeform tag equal to "abandoned", case-insensitive
  imageUrls?: string[]; // work pages only; https only; at most 10
}

export interface Ao3Change {
  field: Ao3OwnedField;
  before: unknown;
  after: unknown;
  added?: string[]; // for array fields
  removed?: string[];
  severity: 'safety' | 'progress' | 'info';
}
