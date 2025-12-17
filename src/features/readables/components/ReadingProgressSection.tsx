// src/features/readables/components/ReadingProgressSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { ProgressMode, ReadableStatus, ReadableType } from '../types';
import TimeHmsFields, {
  hmsPartsToSeconds,
  secondsToHmsParts,
  type TimeHmsValue,
} from './TimeHmsFields';

interface ReadingProgressSectionProps {
  status: ReadableStatus;
  type: ReadableType;

  progressMode: ProgressMode;
  onChangeProgressMode: (mode: ProgressMode) => void | Promise<void>;

  /** Current progress in percent (0–100). */
  currentPercent: number;

  /** Current unit (page or chapter). */
  currentUnit: number | null;

  /**
   * Maximum allowed unit (total pages or total/available chapters).
   * If undefined/null, we won't clamp upwards in the UI.
   */
  maxUnit?: number | null;

  /** Human label for the unit, e.g. "page" or "chapter". */
  unitLabel: string;

  /** Called with the new current unit (page/chapter). */
  onSaveUnit: (unit: number) => void | Promise<void>;

  /** Optional: save percent directly. */
  onSavePercent?: (percent: number) => void | Promise<void>;

  /**
   * Optional: time-based editing.
   */
  timeCurrentSeconds?: number | null;
  timeTotalSeconds?: number | null;
  onSaveTime?: (payload: { currentSeconds: number; totalSeconds: number }) => void | Promise<void>;
}

function clampToMax(value: number, maxUnit?: number | null): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (maxUnit != null && maxUnit > 0) {
    return Math.min(Math.round(value), maxUnit);
  }
  return Math.round(value);
}

const ReadingProgressSection: React.FC<ReadingProgressSectionProps> = ({
  status,
  type,
  progressMode,
  onChangeProgressMode,
  currentPercent,
  currentUnit,
  maxUnit,
  unitLabel,
  onSaveUnit,
  onSavePercent,
  timeCurrentSeconds,
  timeTotalSeconds,
  onSaveTime,
}) => {
  const [unitInput, setUnitInput] = useState<string>(
    currentUnit != null ? String(currentUnit) : '',
  );
  const [percentInput, setPercentInput] = useState<string>(
    Number.isFinite(currentPercent) ? String(currentPercent) : '0',
  );

  const [timeCurrentHms, setTimeCurrentHms] = useState<TimeHmsValue>(
    secondsToHmsParts(timeCurrentSeconds ?? null),
  );
  const [timeTotalHms, setTimeTotalHms] = useState<TimeHmsValue>(
    secondsToHmsParts(timeTotalSeconds ?? null),
  );

  useEffect(() => {
    setUnitInput(currentUnit != null ? String(currentUnit) : '');
  }, [currentUnit]);

  useEffect(() => {
    setPercentInput(Number.isFinite(currentPercent) ? String(currentPercent) : '0');
  }, [currentPercent]);

  useEffect(() => {
    setTimeCurrentHms(secondsToHmsParts(timeCurrentSeconds ?? null));
  }, [timeCurrentSeconds]);

  useEffect(() => {
    setTimeTotalHms(secondsToHmsParts(timeTotalSeconds ?? null));
  }, [timeTotalSeconds]);

  const canEdit = status === 'reading' || status === 'DNF';
  const hasMax = maxUnit != null && maxUnit > 0;

  const hasLockedTotalTime = (timeTotalSeconds ?? null) != null && (timeTotalSeconds ?? 0) > 0;

  const unitFieldLabel = useMemo(() => {
    const base = type === 'book' ? 'Current page' : 'Current chapter';
    return hasMax ? `${base} (max ${maxUnit})` : base;
  }, [type, hasMax, maxUnit]);

  const modeButtons = useMemo(
    () => [
      { value: 'units', label: type === 'book' ? 'Pages' : 'Chapters' },
      { value: 'time', label: 'Time' },
      { value: 'percent', label: '%' },
    ],
    [type],
  );

  const handleSaveUnit = () => {
    const numeric = Number.parseInt(unitInput.replace(/[^0-9]/g, ''), 10);
    const value = Number.isNaN(numeric) ? 0 : numeric;
    const clamped = clampToMax(value, maxUnit);
    void onSaveUnit(clamped);
  };

  const handleSavePercent = () => {
    if (!onSavePercent) return;

    const numeric = Number.parseInt(percentInput.replace(/[^0-9]/g, ''), 10);
    let value = Number.isNaN(numeric) ? 0 : numeric;
    if (value < 0) value = 0;
    if (value > 100) value = 100;

    void onSavePercent(value);
  };

  const handleSaveTime = () => {
    if (!onSaveTime) return;

    const currentSeconds = hmsPartsToSeconds(timeCurrentHms);
    const editedTotalSeconds = hmsPartsToSeconds(timeTotalHms);

    const totalSeconds = hasLockedTotalTime ? (timeTotalSeconds ?? null) : editedTotalSeconds;

    if (currentSeconds == null || totalSeconds == null || totalSeconds <= 0) return;

    const clampedCurrent = Math.min(Math.max(currentSeconds, 0), totalSeconds);

    void onSaveTime({
      currentSeconds: clampedCurrent,
      totalSeconds,
    });
  };

  return (
    <View>
      <SegmentedButtons
        value={progressMode}
        onValueChange={(v) => void onChangeProgressMode(v as ProgressMode)}
        buttons={modeButtons}
      />

      <Text style={styles.currentLine}>Current progress: {currentPercent}%</Text>

      {!canEdit ? (
        <HelperText type="info" visible style={styles.helper}>
          Progress editing is available while status is Reading or DNF.
        </HelperText>
      ) : null}

      {canEdit && progressMode === 'units' && (
        <>
          <TextInput
            mode="outlined"
            label={unitFieldLabel}
            keyboardType="numeric"
            value={unitInput}
            onChangeText={setUnitInput}
            style={styles.progressInput}
          />
          <HelperText type="info" visible style={styles.helper}>
            {hasMax
              ? `Maximum allowed is ${maxUnit}.`
              : `Total ${type === 'book' ? 'pages' : 'chapters'} is unknown, so we won’t clamp.`}
          </HelperText>
          <Button mode="outlined" onPress={handleSaveUnit} style={styles.button}>
            Save {unitLabel}
          </Button>
        </>
      )}

      {canEdit && progressMode === 'percent' && onSavePercent && (
        <>
          <TextInput
            mode="outlined"
            label="Progress (%)"
            keyboardType="numeric"
            value={percentInput}
            onChangeText={setPercentInput}
            style={styles.progressInput}
          />
          <HelperText type="info" visible style={styles.helper}>
            Enter a value between 0 and 100.
          </HelperText>
          <Button mode="outlined" onPress={handleSavePercent} style={styles.button}>
            Save %
          </Button>
        </>
      )}

      {canEdit && progressMode === 'time' && onSaveTime && (
        <>
          <View style={styles.timeBlock}>
            <TimeHmsFields
              label="Current time"
              value={timeCurrentHms}
              onChange={setTimeCurrentHms}
              helperText="This will be converted into a % based on total time."
            />
          </View>

          <View style={styles.timeBlock}>
            <TimeHmsFields
              label="Total time"
              value={timeTotalHms}
              onChange={setTimeTotalHms}
              helperText={
                hasLockedTotalTime
                  ? 'Total time is already set for this readable and is locked.'
                  : 'Set this once to enable time-based % calculation.'
              }
              disabled={hasLockedTotalTime}
            />
          </View>

          <Button mode="outlined" onPress={handleSaveTime} style={styles.button}>
            Save time
          </Button>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  currentLine: {
    marginTop: 8,
  },
  progressInput: {
    marginTop: 8,
    maxWidth: 320,
  },
  helper: {
    marginTop: 4,
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  timeBlock: {
    marginTop: 12,
    maxWidth: 420,
  },
});

export default ReadingProgressSection;
