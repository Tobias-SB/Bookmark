// src/features/readables/components/ReadingProgressSection.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import type { ReadableStatus } from '../types';

interface ReadingProgressSectionProps {
  status: ReadableStatus;
  currentPercent: number;
  onSaveProgress: (percent: number) => void;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Shows current progress and, when appropriate, lets the user edit
 * and save a new progress percentage.
 *
 * - For 'reading' and 'DNF' we show an editable field + "Save progress".
 * - For other statuses, we only show the current value.
 */
const ReadingProgressSection: React.FC<ReadingProgressSectionProps> = ({
  status,
  currentPercent,
  onSaveProgress,
}) => {
  const [inputValue, setInputValue] = useState<string>(String(currentPercent ?? 0));

  // Keep local input in sync when the parent progress changes
  useEffect(() => {
    setInputValue(String(currentPercent ?? 0));
  }, [currentPercent]);

  const handleChangeText = (text: string) => {
    setInputValue(text);
  };

  const handleSave = () => {
    const numeric = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
    const clamped = Number.isNaN(numeric) ? 0 : clampPercent(numeric);
    onSaveProgress(clamped);
  };

  const canEdit = status === 'reading' || status === 'DNF';

  return (
    <View>
      <Text>Current progress: {currentPercent}%</Text>

      {canEdit && (
        <>
          <TextInput
            mode="outlined"
            label="Progress (%)"
            keyboardType="numeric"
            value={inputValue}
            onChangeText={handleChangeText}
            style={styles.progressInput}
          />
          <Button mode="outlined" onPress={handleSave} style={styles.button}>
            Save progress
          </Button>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  progressInput: {
    marginTop: 8,
    maxWidth: 160,
  },
  button: {
    marginTop: 8,
  },
});

export default ReadingProgressSection;
