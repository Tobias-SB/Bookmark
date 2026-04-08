// src/features/import/services/csvExporter.ts
// Pure CSV serialiser for the library export feature.
// No network calls, no React imports.
//
// Output: RFC 4180 CSV with a header row and one row per readable.
// Columns are chosen for human readability and AO3 re-import compatibility.

import type { Readable } from '../../../features/readables/domain/readable';

// ── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Quote a single field per RFC 4180:
 * - If the value contains a comma, double-quote, newline, or carriage return,
 *   wrap it in double-quotes and escape internal double-quotes as "".
 * - Otherwise return the value as-is.
 */
function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Join an array into a pipe-delimited string and CSV-quote if needed. */
function csvArray(values: string[]): string {
  return csvField(values.join(' | '));
}

/** Format a boolean for export: "yes" | "no" | "" */
function csvBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'yes' : 'no';
}

// ── Column definitions ────────────────────────────────────────────────────────

const HEADERS = [
  'Work ID',
  'Title',
  'Author',
  'Kind',
  'Status',
  'Source URL',
  'Rating',
  'Fandom',
  'Relationships',
  'Tags',
  'Archive Warnings',
  'Progress',
  'Total Units',
  'Progress Unit',
  'Available Chapters',
  'Word Count',
  'Complete',
  'Abandoned',
  'Date Added',
  'Notes',
] as const;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Serialize an array of readables as RFC 4180 CSV.
 * Returns a complete string including the header row and CRLF line endings.
 */
export function generateCsvContent(readables: Readable[]): string {
  const rows: string[] = [HEADERS.map(csvField).join(',')];

  for (const r of readables) {
    const row = [
      csvField(r.sourceId),
      csvField(r.title),
      csvField(r.author),
      csvField(r.kind),
      csvField(r.status),
      csvField(r.sourceUrl),
      csvField(r.rating),
      csvArray(r.fandom),
      csvArray(r.relationships),
      csvArray(r.tags),
      csvArray(r.archiveWarnings),
      csvField(r.progressCurrent),
      csvField(r.totalUnits),
      csvField(r.progressUnit),
      csvField(r.availableChapters),
      csvField(r.wordCount),
      csvBool(r.isComplete),
      csvBool(r.isAbandoned),
      csvField(r.dateAdded),
      csvField(r.notes),
    ].join(',');
    rows.push(row);
  }

  // RFC 4180 specifies CRLF line endings.
  return rows.join('\r\n');
}
