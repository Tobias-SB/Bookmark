// src/features/metadata/services/types.ts
// §6 — Metadata service return contract.
// Every metadata service returns Promise<MetadataResult> — never throws.
// On total failure: data is {}, errors contains a human-readable reason.
// On partial success: data contains successfully extracted fields.

export interface ImportedMetadata {
  title: string;
  /** null for anonymous or unavailable author. */
  author: string | null;
  summary: string | null;
  /** Flat string array. */
  tags: string[];
  progressCurrent: number | null;
  progressTotal: number | null;
  /** AO3 only: false = WIP, true = Complete. null for books. */
  isComplete: boolean | null;
  sourceUrl: string | null;
  /** External provider ID (e.g. Google Books volume ID, AO3 numeric work ID). */
  sourceId: string | null;
}

export interface MetadataResult {
  /** Successfully extracted fields. May be partial or empty on failure. */
  data: Partial<ImportedMetadata>;
  /** Human-readable error messages. Empty array on full success. */
  errors: string[];
}
