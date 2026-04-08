// src/features/import/ui/ImportScreen.tsx
// Feature 7 — CSV Import screen.
// Full stack screen (not modal) — imports can take minutes.
//
// Four sequential states driven by useImportCsv():
//   1. Pick file   (idle / picking)
//   2. Confirm     (confirming)  — column picker shown when auto-detection fails
//   3. Progress    (importing)
//   4. Summary     (done)

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
} from 'react-native';
import { ActivityIndicator, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAppTheme } from '../../../app/theme';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useImportCsv } from '../hooks/useImportCsv';
import type { ImportProgress } from '../services/importPipeline';

// ── Navigation ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'ImportCsv'>;

// ── Helper: pluralise ─────────────────────────────────────────────────────────

function plural(count: number, singular: string, pl?: string): string {
  return `${count} ${count === 1 ? singular : (pl ?? singular + 's')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** State 1: Pick file */
function PickState({
  isPicking,
  parseError,
  onPick,
}: {
  isPicking: boolean;
  parseError: string | null;
  onPick: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={pickStyles.container}>
      {/* Icon placeholder — simple bordered rectangle */}
      <View
        style={[
          pickStyles.iconArea,
          {
            backgroundColor: theme.colors.backgroundCard,
            borderColor: theme.colors.backgroundBorder,
          },
        ]}
      >
        <Text style={[pickStyles.iconText, { color: theme.colors.textMeta }]}>
          CSV
        </Text>
      </View>
      <Text style={[pickStyles.heading, { color: theme.colors.textBody }]}>
        Import from CSV
      </Text>
      <Text style={[pickStyles.hint, { color: theme.colors.textHint }]}>
        AO3 bookmark and history exports are supported.
      </Text>

      {/* Parse error feedback */}
      {parseError !== null && (
        <Text
          style={[pickStyles.errorText, { color: theme.colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {parseError}
        </Text>
      )}

      <TouchableOpacity
        onPress={onPick}
        disabled={isPicking}
        style={[
          pickStyles.button,
          {
            backgroundColor: theme.colors.kindFanfic,
            opacity: isPicking ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Select a CSV or TSV file"
        accessibilityRole="button"
        accessibilityState={{ disabled: isPicking }}
      >
        {isPicking ? (
          <ActivityIndicator size={18} color={theme.colors.backgroundPage} />
        ) : (
          <Text style={[pickStyles.buttonText, { color: theme.colors.backgroundPage }]}>
            Select file
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const pickStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconArea: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    minHeight: 48,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

/** State 2: Confirm */
function ConfirmState({
  urls,
  detectedColumn,
  columns,
  totalRows,
  skippedRows,
  onStart,
  onPickColumn,
  onChooseDifferentFile,
}: {
  urls: string[];
  detectedColumn: string | null;
  columns: string[];
  totalRows: number;
  skippedRows: number;
  onStart: () => void;
  onPickColumn: (col: string) => void;
  onChooseDifferentFile: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={confirmStyles.container}>
      {/* Column picker — shown only when auto-detection failed */}
      {detectedColumn === null && (
        <View style={confirmStyles.pickerSection}>
          <Text style={[confirmStyles.pickerHeading, { color: theme.colors.textBody }]}>
            Could not detect a URL column automatically.
          </Text>
          <Text style={[confirmStyles.pickerHint, { color: theme.colors.textHint }]}>
            Choose the column that contains AO3 work links:
          </Text>
          <FlatList
            data={columns}
            keyExtractor={(col) => col}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={confirmStyles.chipRow}
            renderItem={({ item: col }) => (
              <TouchableOpacity
                onPress={() => onPickColumn(col)}
                style={[
                  confirmStyles.chip,
                  {
                    backgroundColor: theme.colors.backgroundCard,
                    borderColor: theme.colors.backgroundBorder,
                  },
                ]}
                accessibilityLabel={`Use column ${col}`}
                accessibilityRole="button"
              >
                <Text style={[confirmStyles.chipText, { color: theme.colors.textBody }]}>
                  {col}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* URL count summary */}
      {(detectedColumn !== null || urls.length > 0) && (
        <View
          style={[
            confirmStyles.summaryCard,
            {
              backgroundColor: theme.colors.backgroundCard,
              borderColor: theme.colors.backgroundBorder,
            },
          ]}
        >
          {detectedColumn !== null && (
            <Text style={[confirmStyles.columnLabel, { color: theme.colors.textHint }]}>
              Column: {detectedColumn}
            </Text>
          )}
          <Text style={[confirmStyles.countText, { color: theme.colors.textBody }]}>
            Found{' '}
            <Text style={{ fontWeight: '700' }}>
              {plural(urls.length, 'AO3 work')}
            </Text>
            {' '}in {plural(totalRows, 'row')}.
          </Text>
          {skippedRows > 0 && (
            <Text style={[confirmStyles.skippedText, { color: theme.colors.textHint }]}>
              {plural(skippedRows, 'row')} skipped — not AO3 URLs.
            </Text>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={confirmStyles.actions}>
        <TouchableOpacity
          onPress={onStart}
          disabled={urls.length === 0}
          style={[
            confirmStyles.startButton,
            {
              backgroundColor: theme.colors.kindFanfic,
              opacity: urls.length === 0 ? 0.4 : 1,
            },
          ]}
          accessibilityLabel={`Start import of ${urls.length} works`}
          accessibilityRole="button"
          accessibilityState={{ disabled: urls.length === 0 }}
        >
          <Text style={[confirmStyles.startButtonText, { color: theme.colors.backgroundPage }]}>
            Start import
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onChooseDifferentFile}
          style={confirmStyles.secondaryButton}
          accessibilityLabel="Choose a different file"
          accessibilityRole="button"
        >
          <Text style={[confirmStyles.secondaryButtonText, { color: theme.colors.textMeta }]}>
            Choose a different file
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const confirmStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  pickerSection: {
    gap: 8,
  },
  pickerHeading: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerHint: {
    fontSize: 14,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    // paddingVertical provides layout padding; minHeight satisfies the 44pt touch target.
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  countText: {
    fontSize: 16,
    lineHeight: 22,
  },
  skippedText: {
    fontSize: 13,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  startButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    // Meets the 44pt minimum touch target while keeping a lean visual weight.
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
  },
});

/** State 3: Progress */
function ProgressState({ progress }: { progress: ImportProgress }) {
  const theme = useAppTheme();
  const fillRatio =
    progress.total > 0 ? progress.completed / progress.total : 0;

  return (
    <View style={progressStyles.container}>
      <Text
        style={[progressStyles.heading, { color: theme.colors.textBody }]}
        accessibilityLiveRegion="polite"
      >
        Importing — {progress.completed} / {progress.total}
      </Text>

      <ProgressBar
        progress={fillRatio}
        color={theme.colors.kindFanfic}
        style={[
          progressStyles.bar,
          { backgroundColor: theme.colors.backgroundInput },
        ]}
      />

      {progress.currentTitle !== null && (
        <Text
          style={[progressStyles.currentTitle, { color: theme.colors.textMeta }]}
          numberOfLines={2}
        >
          {progress.currentTitle}
        </Text>
      )}

      <Text style={[progressStyles.hint, { color: theme.colors.textHint }]}>
        Navigate back to stop.
      </Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 20,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  currentTitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
});

/** State 4: Summary */
function SummaryState({
  result,
  onDone,
}: {
  result: ImportProgress;
  onDone: () => void;
}) {
  const theme = useAppTheme();

  // Build summary rows — always show Created; others shown only when > 0
  const rows: { label: string; count: number; highlight?: boolean }[] = [
    { label: 'Created', count: result.created, highlight: result.created > 0 },
    { label: 'Already in library', count: result.skipped },
    { label: 'Failed', count: result.failed },
    { label: 'Restricted', count: result.restricted },
  ].filter((r) => r.label === 'Created' || r.count > 0);

  return (
    <View style={summaryStyles.container}>
      <Text style={[summaryStyles.heading, { color: theme.colors.textBody }]}>
        Import complete
      </Text>

      <View
        style={[
          summaryStyles.card,
          {
            backgroundColor: theme.colors.backgroundCard,
            borderColor: theme.colors.backgroundBorder,
          },
        ]}
      >
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              summaryStyles.row,
              index < rows.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.backgroundInput,
              },
            ]}
          >
            <Text style={[summaryStyles.rowLabel, { color: theme.colors.textMeta }]}>
              {row.label}
            </Text>
            <Text
              style={[
                summaryStyles.rowCount,
                {
                  color: row.highlight
                    ? theme.colors.kindFanfic
                    : theme.colors.textBody,
                  fontWeight: row.highlight ? '700' : '500',
                },
              ]}
            >
              {row.count}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onDone}
        style={[
          summaryStyles.doneButton,
          { backgroundColor: theme.colors.kindFanfic },
        ]}
        accessibilityLabel="Done"
        accessibilityRole="button"
      >
        <Text style={[summaryStyles.doneButtonText, { color: theme.colors.backgroundPage }]}>
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowCount: {
    fontSize: 16,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function ImportScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const { phase, parseResult, progress, finalResult, parseError, pickAndParse, startImport, reset } =
    useImportCsv();

  const handleChooseDifferentFile = () => {
    reset();
    void pickAndParse();
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.backgroundPage }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {(phase === 'idle' || phase === 'picking') && (
        <PickState
          isPicking={phase === 'picking'}
          parseError={parseError}
          onPick={() => void pickAndParse()}
        />
      )}

      {phase === 'confirming' && parseResult !== null && (
        <ConfirmState
          urls={parseResult.urls}
          detectedColumn={parseResult.detectedColumn}
          columns={parseResult.columns}
          totalRows={parseResult.totalRows}
          skippedRows={parseResult.skippedRows}
          onStart={() => void startImport()}
          onPickColumn={(col) => void pickAndParse(col)}
          onChooseDifferentFile={handleChooseDifferentFile}
        />
      )}

      {phase === 'importing' && progress !== null && (
        <ProgressState progress={progress} />
      )}

      {phase === 'done' && finalResult !== null && (
        <SummaryState result={finalResult} onDone={() => navigation.goBack()} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
