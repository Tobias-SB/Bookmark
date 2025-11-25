// src/components/common/TextInputField.tsx
import React from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { TextInput, HelperText } from 'react-native-paper';

interface TextInputFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  secureTextEntry?: boolean;
}

function TextInputField<TFieldValues extends FieldValues>(
  props: TextInputFieldProps<TFieldValues>,
) {
  const { control, name, label, multiline, keyboardType, secureTextEntry } = props;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <>
          <TextInput
            mode="outlined"
            label={label}
            value={value as string | undefined}
            onBlur={onBlur}
            onChangeText={onChange}
            multiline={multiline}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
          />
          {error ? (
            <HelperText type="error" visible={true}>
              {error.message}
            </HelperText>
          ) : null}
        </>
      )}
    />
  );
}

export default TextInputField;
