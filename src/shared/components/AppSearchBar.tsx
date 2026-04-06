// src/shared/components/AppSearchBar.tsx
// Shared search-bar input used across screens (LibraryScreen full header +
// compact header). A single component removes the risk of the two instances
// drifting in style or behaviour over time.

import React from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '../../app/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Height of the pill container. Default 46. Use 38 for the compact header. */
  height?: number;
  /** Show card shadow beneath the pill. Default true. */
  shadow?: boolean;
  accessibilityLabel?: string;
  /** Additional TextInput props forwarded to the inner input. */
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'accessibilityLabel'>;
}

export function AppSearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  height = 46,
  shadow = true,
  accessibilityLabel,
  inputProps,
}: Props) {
  const theme = useAppTheme();
  const borderRadius = Math.round(height / 2);

  return (
    <View
      style={[
        {
          height,
          borderRadius,
          backgroundColor: theme.colors.backgroundCard,
          borderWidth: 1,
          borderColor: theme.colors.backgroundBorder,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        },
        shadow ? theme.shadows.small : undefined,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textHint}
        style={{ flex: 1, fontSize: 14, color: theme.colors.textPrimary }}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        {...inputProps}
      />
    </View>
  );
}
