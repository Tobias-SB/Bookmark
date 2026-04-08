// src/features/import/hooks/useImportCsv.ts
// Orchestrates the CSV import flow.
//
// Phase state machine:
//   idle → picking → confirming → importing → done
//
// pickAndParse()                  — opens document picker, reads and parses file
// pickAndParse(columnOverride)    — re-parses the same URI without reopening picker
// startImport()                   — runs the sequential AO3 fetch pipeline
// reset()                         — returns to idle, clears all state
//
// uriRef stores the picked URI so column overrides don't reopen the picker.

import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { readableKeys } from '../../readables';
import { parseCsvFile } from '../services/csvParser';
import type { CsvParseResult } from '../services/csvParser';
import { runImportPipeline } from '../services/importPipeline';
import type { ImportProgress } from '../services/importPipeline';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImportPhase = 'idle' | 'picking' | 'confirming' | 'importing' | 'done';

export interface UseImportCsvResult {
  phase: ImportPhase;
  parseResult: CsvParseResult | null;
  /** Live progress during the import phase. */
  progress: ImportProgress | null;
  /** Final counts once the import is complete. */
  finalResult: ImportProgress | null;
  /**
   * Non-null when the file could not be read or parsed.
   * Cleared by reset() or a successful subsequent parse.
   */
  parseError: string | null;
  /**
   * With no argument: opens the document picker, then parses the selected file.
   * With columnOverride: re-parses the already-picked file using the given column
   * name — does not reopen the picker. Used when the user selects a column manually.
   */
  pickAndParse: (columnOverride?: string) => Promise<void>;
  /** Starts the sequential fetch-and-create pipeline. */
  startImport: () => Promise<void>;
  /** Clears all state and returns to idle. */
  reset: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImportCsv(): UseImportCsvResult {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [finalResult, setFinalResult] = useState<ImportProgress | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Stable ref: preserves the picked URI so column overrides re-parse without
  // reopening the document picker.
  const uriRef = useRef<string | null>(null);

  const pickAndParse = useCallback(
    async (columnOverride?: string) => {
      let uri: string | null = null;

      if (columnOverride !== undefined && uriRef.current !== null) {
        // Column override: re-use the existing URI
        uri = uriRef.current;
      } else {
        // Open document picker
        setPhase('picking');
        setParseError(null);
        const picked = await DocumentPicker.getDocumentAsync({
          // Cast to any[] to satisfy the union type — expo-document-picker accepts
          // standard MIME types; '*/*' is the fallback for file managers that don't
          // expose MIME types for CSV/TSV files.
          type: ['text/csv', 'text/tab-separated-values', 'text/plain', '*/*'] as string[],
          copyToCacheDirectory: true,
        });
        if (picked.canceled || picked.assets.length === 0) {
          setPhase('idle');
          return;
        }
        uri = picked.assets[0].uri;
        uriRef.current = uri;
      }

      try {
        const result = await parseCsvFile(uri, columnOverride);
        setParseResult(result);
        setParseError(null);
        setPhase('confirming');
      } catch (err) {
        // File read or parse error — return to idle and surface the message
        const message =
          err instanceof Error ? err.message : 'Could not read the file. Please try again.';
        setParseError(message);
        setPhase('idle');
      }
    },
    [],
  );

  const startImport = useCallback(async () => {
    if (parseResult === null || parseResult.urls.length === 0) return;

    const initialProgress: ImportProgress = {
      total: parseResult.urls.length,
      completed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      restricted: 0,
      currentTitle: null,
    };

    setProgress(initialProgress);
    setPhase('importing');

    const result = await runImportPipeline(db, parseResult.urls, (p) => {
      setProgress(p);
    });

    setFinalResult(result);
    setPhase('done');

    // Invalidate the readable list so the library reflects newly imported works
    await queryClient.invalidateQueries({ queryKey: readableKeys.all });
  }, [db, parseResult, queryClient]);

  const reset = useCallback(() => {
    uriRef.current = null;
    setPhase('idle');
    setParseResult(null);
    setProgress(null);
    setFinalResult(null);
    setParseError(null);
  }, []);

  return { phase, parseResult, progress, finalResult, parseError, pickAndParse, startImport, reset };
}
