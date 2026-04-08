// src/features/import/hooks/useExportCsv.ts
// Exports the full library as a CSV file and opens the OS share sheet.
//
// Flow:
//   1. Fetch all readables via listReadables(db)
//   2. Serialise with generateCsvContent()
//   3. Write to a dated cache file via expo-file-system v2
//   4. Share the file via expo-sharing
//
// Errors are surfaced through useSnackbar() — no throws reach the caller.

import { useState, useCallback } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useDatabase } from '../../../app/database/DatabaseProvider';
import { listReadables } from '../../readables';
import { useSnackbar } from '../../../shared/hooks/useSnackbar';
import { generateCsvContent } from '../services/csvExporter';

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseExportCsvResult {
  exportCsv: () => Promise<void>;
  isExporting: boolean;
  snackbarMessage: string | null;
  hideSnackbar: () => void;
}

export function useExportCsv(): UseExportCsvResult {
  const db = useDatabase();
  const [isExporting, setIsExporting] = useState(false);
  const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();

  const exportCsv = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const readables = await listReadables(db);

      if (readables.length === 0) {
        showSnackbar('Your library is empty — nothing to export.');
        return;
      }

      const content = generateCsvContent(readables);

      // Write to a dated file in the cache directory so it is not included in
      // device backups and is eventually cleaned up by the OS.
      const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filename = `bookmark-export-${dateStr}.csv`;
      const file = new File(Paths.cache, filename);
      file.write(content);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Library',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Export failed. Please try again.';
      showSnackbar(message);
    } finally {
      setIsExporting(false);
    }
  }, [db, isExporting, showSnackbar]);

  return { exportCsv, isExporting, snackbarMessage, hideSnackbar };
}
