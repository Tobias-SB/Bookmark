// src/features/import/services/csvParser.ts
// On-device CSV/TSV parser — no network calls.
// Reads a local file URI (from expo-document-picker), detects delimiter,
// locates the AO3 URL column, and returns deduplicated canonical work URLs.
//
// New pattern: first services/ subfolder in the import feature.

import { File } from 'expo-file-system';

import { processAo3Url } from '../../../shared/utils/ao3Url';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CsvParseResult {
  /** Deduplicated canonical AO3 work URLs (https://archiveofourown.org/works/{id}). */
  urls: string[];
  /**
   * Name of the column that URLs were extracted from.
   * Null when auto-detection failed — the UI shows a column picker in that case.
   */
  detectedColumn: string | null;
  /**
   * All header column names from the file.
   * Used to render the column picker when detectedColumn is null.
   * Provisional addition: not in backlog spec but required for the column-picker UI.
   */
  columns: string[];
  /** Number of data rows (excluding the header row). */
  totalRows: number;
  /** Rows where the target cell was not a valid AO3 URL. */
  skippedRows: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Column name keywords that likely indicate an AO3 URL column (case-insensitive). */
const URL_COLUMN_KEYWORDS = ['url', 'link', 'work', 'ao3'];

/**
 * Split a single CSV line respecting RFC 4180 quoted fields.
 * Handles:
 *   - Fields enclosed in double-quotes
 *   - Escaped double-quotes inside quoted fields ("")
 *   - Unquoted fields separated by commas
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // Trailing comma produced an empty field — stop.
      break;
    }
    if (line[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          // Escaped double-quote
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (line[i] === ',') i++; // skip delimiter
    } else {
      // Unquoted field — read until next comma or end
      const start = i;
      while (i < line.length && line[i] !== ',') i++;
      fields.push(line.slice(start, i));
      if (line[i] === ',') i++; // skip delimiter
    }
  }
  return fields;
}

/** Split a row using the detected delimiter. */
function splitRow(line: string, isTabDelimited: boolean): string[] {
  return isTabDelimited ? line.split('\t') : splitCsvLine(line);
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a CSV or TSV file at the given local URI.
 *
 * Auto-detects the delimiter and URL column. Pass `columnOverride` when the
 * user has manually selected a column — this re-parses the same URI without
 * reopening the picker.
 *
 * @param uri            Local file URI (expo-document-picker result).
 * @param columnOverride Column name to use instead of auto-detection.
 */
export async function parseCsvFile(
  uri: string,
  columnOverride?: string,
): Promise<CsvParseResult> {
  const raw = await new File(uri).text();

  // Normalise line endings; remove blank lines
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    // No data rows — file is empty or header-only
    return { urls: [], detectedColumn: null, columns: [], totalRows: 0, skippedRows: 0 };
  }

  // Detect delimiter: count tabs vs commas in the header row
  const headerLine = lines[0];
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const isTabDelimited = tabCount > commaCount;

  const headers = splitRow(headerLine, isTabDelimited).map((h) => h.trim());

  // ── Determine target column ──────────────────────────────────────────────────

  let targetColumn: string | null = null;

  if (columnOverride !== undefined) {
    // User explicitly chose a column — use it if it exists in the headers
    targetColumn = headers.find((h) => h === columnOverride) ?? null;
  } else {
    // Auto-detect: find a header containing a URL-like keyword
    targetColumn =
      headers.find((h) =>
        URL_COLUMN_KEYWORDS.some((kw) => h.toLowerCase().includes(kw)),
      ) ?? null;

    // Fallback: scan the first data row for a cell containing an AO3 URL
    if (targetColumn === null) {
      const firstDataFields = splitRow(lines[1], isTabDelimited);
      for (let i = 0; i < firstDataFields.length; i++) {
        if (processAo3Url(firstDataFields[i].trim()) !== null) {
          targetColumn = headers[i] ?? null;
          break;
        }
      }
    }
  }

  const columnIndex = targetColumn !== null ? headers.indexOf(targetColumn) : -1;

  // ── Extract and deduplicate URLs ─────────────────────────────────────────────

  const seenWorkIds = new Set<string>();
  const urls: string[] = [];
  let skippedRows = 0;
  const dataLines = lines.slice(1);

  for (const line of dataLines) {
    const fields = splitRow(line, isTabDelimited);
    const cellValue = columnIndex >= 0 ? (fields[columnIndex] ?? '').trim() : '';
    const processed = processAo3Url(cellValue);

    if (processed === null) {
      skippedRows++;
      continue;
    }
    if (seenWorkIds.has(processed.workId)) {
      // Duplicate work ID — skip silently (not counted as a skipped row)
      continue;
    }
    seenWorkIds.add(processed.workId);
    urls.push(processed.canonicalUrl);
  }

  return {
    urls,
    detectedColumn: targetColumn,
    columns: headers,
    totalRows: dataLines.length,
    skippedRows,
  };
}
