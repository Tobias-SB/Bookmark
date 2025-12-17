import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';

export interface TimeHmsValue {
  hh: string;
  mm: string;
  ss: string;
}

export function secondsToHmsParts(seconds: number | null | undefined): TimeHmsValue {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return { hh: '', mm: '', ss: '' };
  }
  const total = Math.floor(seconds);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;

  return {
    hh: String(hh).padStart(2, '0'),
    mm: String(mm).padStart(2, '0'),
    ss: String(ss).padStart(2, '0'),
  };
}

export function hmsPartsToSeconds(value: TimeHmsValue): number | null {
  const hh = value.hh.trim() === '' ? 0 : Number.parseInt(value.hh, 10);
  const mm = value.mm.trim() === '' ? 0 : Number.parseInt(value.mm, 10);
  const ss = value.ss.trim() === '' ? 0 : Number.parseInt(value.ss, 10);

  if ([hh, mm, ss].some((n) => Number.isNaN(n) || n < 0)) return null;
  if (mm >= 60 || ss >= 60) return null;

  const total = hh * 3600 + mm * 60 + ss;
  return total;
}

function sanitizeNumeric(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

interface TimeHmsFieldsProps {
  label: string;
  value: TimeHmsValue;
  onChange: (next: TimeHmsValue) => void;
  disabled?: boolean;
  helperText?: string;
}

const TimeHmsFields: React.FC<TimeHmsFieldsProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  helperText,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        <TextInput
          mode="outlined"
          label="HH"
          value={value.hh}
          onChangeText={(t) => onChange({ ...value, hh: sanitizeNumeric(t).slice(0, 3) })}
          keyboardType="numeric"
          style={styles.field}
          disabled={disabled}
        />
        <TextInput
          mode="outlined"
          label="MM"
          value={value.mm}
          onChangeText={(t) => onChange({ ...value, mm: sanitizeNumeric(t).slice(0, 2) })}
          keyboardType="numeric"
          style={styles.field}
          disabled={disabled}
        />
        <TextInput
          mode="outlined"
          label="SS"
          value={value.ss}
          onChangeText={(t) => onChange({ ...value, ss: sanitizeNumeric(t).slice(0, 2) })}
          keyboardType="numeric"
          style={styles.field}
          disabled={disabled}
        />
      </View>

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    flex: 1,
  },
  helper: {
    marginTop: 6,
    opacity: 0.7,
    fontSize: 12,
  },
});

export default TimeHmsFields;
