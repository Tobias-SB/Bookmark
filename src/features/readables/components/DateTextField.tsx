// src/features/readables/components/DateTextField.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HelperText, TextInput, Text } from 'react-native-paper';

interface DateTextFieldProps {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  helperText?: string;
  disabled?: boolean;
}

/**
 * Simple text-based date field.
 * Expects ISO-like `YYYY-MM-DD` strings or empty.
 * You can later upgrade this to a real date picker
 * while keeping the same props.
 */
export const DateTextField: React.FC<DateTextFieldProps> = ({
  label,
  value,
  onChange,
  helperText,
  disabled = false,
}) => {
  const [touched, setTouched] = React.useState(false);

  const textValue = value ?? '';

  const isValid = React.useMemo(() => {
    if (!textValue) return true; // empty is ok
    // naive YYYY-MM-DD check
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textValue);
    if (!m) return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    // let the Date constructor handle weird combos; just reject obvious nonsense
    const d = new Date(textValue);
    return !Number.isNaN(d.getTime());
  }, [textValue]);

  const showError = touched && !isValid;

  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        label={label}
        value={textValue}
        onChangeText={(txt) => onChange(txt.trim() === '' ? null : txt.trim())}
        onBlur={() => setTouched(true)}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        disabled={disabled}
      />
      {helperText && !showError && (
        <HelperText type="info" visible>
          {helperText}
        </HelperText>
      )}
      {showError && (
        <HelperText type="error" visible>
          Please use YYYY-MM-DD (e.g. 2025-03-15)
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
});

export default DateTextField;
