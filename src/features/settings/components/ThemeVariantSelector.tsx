// src/features/settings/components/ThemeVariantSelector.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, RadioButton } from 'react-native-paper';
import { useAppThemeMode } from '@src/theme';
import type { ThemeVariant } from '@src/features/settings/services/settingsRepository';

const ThemeVariantSelector: React.FC = () => {
  const { themeVariant, setThemeVariant } = useAppThemeMode();

  const handleChange = (value: string) => {
    setThemeVariant(value as ThemeVariant);
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Theme
      </Text>
      <Text variant="bodySmall" style={styles.subtitle}>
        Choose a preset colour theme.
      </Text>

      <RadioButton.Group onValueChange={handleChange} value={themeVariant}>
        <View style={styles.optionRow}>
          <RadioButton value="default" />
          <View style={styles.optionText}>
            <Text>Default</Text>
            <Text style={styles.optionDescription}>Uses the standard Bookmark colour palette.</Text>
          </View>
        </View>

        <View style={styles.optionRow}>
          <RadioButton value="raspberryLemonade" />
          <View style={styles.optionText}>
            <Text>Raspberry Lemonade</Text>
            <Text style={styles.optionDescription}>Pink &amp; yellow with playful accents.</Text>
          </View>
        </View>

        <View style={styles.optionRow}>
          <RadioButton value="libraryShelves" />
          <View style={styles.optionText}>
            <Text>Library Shelves</Text>
            <Text style={styles.optionDescription}>
              Warm wood and parchment, cozy library feel.
            </Text>
          </View>
        </View>
      </RadioButton.Group>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionText: {
    flexDirection: 'column',
  },
  optionDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default ThemeVariantSelector;
