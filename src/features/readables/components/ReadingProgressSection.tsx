// src/features/readables/components/ReadingProgressSection.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import type { ReadableStatus, ReadableType } from '../types';

interface ReadingProgressSectionProps {
  status: ReadableStatus;
  type: ReadableType;

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
   * Optional: time-based editing. These are *display-only*; if omitted,
   * the time fields will start empty.
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

function secondsToHmsString(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(
      2,
      '0',
    )}`;
  }

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse 'HH:MM:SS', 'MM:SS' or 'SS' into seconds.
 * Returns null for invalid input.
 */
function hmsStringToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;

  const nums = parts.map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isNaN(n) || n < 0 ? NaN : n;
  });

  if (nums.some((n) => Number.isNaN(n))) return null;

  let seconds = 0;
  if (nums.length === 1) {
    // SS
    seconds = nums[0];
  } else if (nums.length === 2) {
    // MM:SS
    const [m, s] = nums;
    if (s >= 60) return null;
    seconds = m * 60 + s;
  } else {
    // HH:MM:SS
    const [h, m, s] = nums;
    if (m >= 60 || s >= 60) return null;
    seconds = h * 3600 + m * 60 + s;
  }

  return seconds;
}

/**
 * Unit + percent + optional time-based progress editor.
 *
 * - For 'reading' and 'DNF' we show editable fields.
 * - For other statuses, we only show the current values.
 */
const ReadingProgressSection: React.FC<ReadingProgressSectionProps> = ({
  status,
  type,
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
  const [timeCurrentText, setTimeCurrentText] = useState<string>(
    secondsToHmsString(timeCurrentSeconds),
  );
  const [timeTotalText, setTimeTotalText] = useState<string>(secondsToHmsString(timeTotalSeconds));

  useEffect(() => {
    setUnitInput(currentUnit != null ? String(currentUnit) : '');
  }, [currentUnit]);

  useEffect(() => {
    setPercentInput(Number.isFinite(currentPercent) ? String(currentPercent) : '0');
  }, [currentPercent]);

  useEffect(() => {
    setTimeCurrentText(secondsToHmsString(timeCurrentSeconds));
  }, [timeCurrentSeconds]);

  useEffect(() => {
    setTimeTotalText(secondsToHmsString(timeTotalSeconds));
  }, [timeTotalSeconds]);

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

    const currentSeconds = hmsStringToSeconds(timeCurrentText);
    const totalSeconds = hmsStringToSeconds(timeTotalText);

    if (currentSeconds == null || totalSeconds == null || totalSeconds <= 0) {
      // Very lightweight validation; you can add HelperText if you want later.
      return;
    }

    const clampedCurrent = Math.min(Math.max(currentSeconds, 0), totalSeconds);

    void onSaveTime({
      currentSeconds: clampedCurrent,
      totalSeconds,
    });
  };

  const canEdit = status === 'reading' || status === 'DNF';

  const unitFieldLabel =
    type === 'book'
      ? `Current ${unitLabel} (${maxUnit != null ? `max ${maxUnit}` : 'no max set'})`
      : `Current ${unitLabel}${maxUnit != null ? ` (max ${maxUnit})` : ''}`;

  const hasMax = maxUnit != null && maxUnit > 0;

  return (
    <View>
      <Text>Current progress: {currentPercent}%</Text>

      {canEdit && (
        <>
          {/* Unit editor */}
          <TextInput
            mode="outlined"
            label={unitFieldLabel}
            keyboardType="numeric"
            value={unitInput}
            onChangeText={setUnitInput}
            style={styles.progressInput}
          />
          <HelperText type="info" visible={hasMax} style={styles.helper}>
            {hasMax
              ? `Maximum allowed ${unitLabel} is ${maxUnit}.`
              : `Progress is tracked by ${unitLabel}, but total is currently unknown.`}
          </HelperText>
          <Button mode="outlined" onPress={handleSaveUnit} style={styles.button}>
            Save {unitLabel}
          </Button>

          {/* Percent editor (optional) */}
          {onSavePercent && (
            <>
              <Text style={styles.subheading}>Set progress by percent</Text>
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

          {/* Time editor (optional) */}
          {onSaveTime && (
            <>
              <Text style={styles.subheading}>Set progress by time</Text>
              <TextInput
                mode="outlined"
                label="Current time (HH:MM:SS, MM:SS, or SS)"
                keyboardType="numeric"
                value={timeCurrentText}
                onChangeText={setTimeCurrentText}
                style={styles.progressInput}
              />
              <TextInput
                mode="outlined"
                label="Total time (HH:MM:SS, MM:SS, or SS)"
                keyboardType="numeric"
                value={timeTotalText}
                onChangeText={setTimeTotalText}
                style={styles.progressInput}
              />
              <HelperText type="info" visible style={styles.helper}>
                Time is used to calculate the %; it isn&apos;t stored separately (yet).
              </HelperText>
              <Button mode="outlined" onPress={handleSaveTime} style={styles.button}>
                Save time
              </Button>
            </>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  progressInput: {
    marginTop: 8,
    maxWidth: 260,
  },
  helper: {
    marginTop: 4,
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  subheading: {
    marginTop: 16,
    fontWeight: '500',
  },
});

export default ReadingProgressSection;
