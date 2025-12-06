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
  onSaveUnit: (unit: number) => void;
}

function clampToMax(value: number, maxUnit?: number | null): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (maxUnit != null && maxUnit > 0) {
    return Math.min(Math.round(value), maxUnit);
  }
  return Math.round(value);
}

/**
 * Unit-based progress editor.
 *
 * - For 'reading' and 'DNF' we show an editable field + "Save" button.
 * - For other statuses, we only show the current value.
 */
const ReadingProgressSection: React.FC<ReadingProgressSectionProps> = ({
  status,
  type,
  currentPercent,
  currentUnit,
  maxUnit,
  unitLabel,
  onSaveUnit,
}) => {
  const [inputValue, setInputValue] = useState<string>(
    currentUnit != null ? String(currentUnit) : '',
  );

  useEffect(() => {
    setInputValue(currentUnit != null ? String(currentUnit) : '');
  }, [currentUnit]);

  const handleChangeText = (text: string) => {
    setInputValue(text);
  };

  const handleSave = () => {
    const numeric = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(numeric)) {
      onSaveUnit(0);
      return;
    }
    const clamped = clampToMax(numeric, maxUnit);
    onSaveUnit(clamped);
  };

  const canEdit = status === 'reading' || status === 'DNF';

  const label =
    type === 'book'
      ? `Current ${unitLabel} (${maxUnit != null ? `max ${maxUnit}` : 'no max set'})`
      : `Current ${unitLabel}${maxUnit != null ? ` (max ${maxUnit})` : ''}`;

  const hasMax = maxUnit != null && maxUnit > 0;

  return (
    <View>
      <Text>Current progress: {currentPercent}%</Text>

      {canEdit && (
        <>
          <TextInput
            mode="outlined"
            label={label}
            keyboardType="numeric"
            value={inputValue}
            onChangeText={handleChangeText}
            style={styles.progressInput}
          />
          <HelperText type="info" visible={hasMax} style={styles.helper}>
            {hasMax
              ? `Maximum allowed ${unitLabel} is ${maxUnit}.`
              : `Progress is tracked by ${unitLabel}, but total is currently unknown.`}
          </HelperText>
          <Button mode="outlined" onPress={handleSave} style={styles.button}>
            Save {unitLabel}
          </Button>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  progressInput: {
    marginTop: 8,
    maxWidth: 200,
  },
  helper: {
    marginTop: 4,
  },
  button: {
    marginTop: 8,
  },
});

export default ReadingProgressSection;
