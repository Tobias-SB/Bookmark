// src/features/settings/components/ThemeToggle.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { useAppThemeMode } from '@src/theme';

const ThemeToggle: React.FC = () => {
  const { mode, toggleMode } = useAppThemeMode();
  const isDark = mode === 'dark';

  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="titleMedium">Dark mode</Text>
        <Text variant="bodySmall">Toggle between light and dark theme.</Text>
      </View>
      <Switch value={isDark} onValueChange={toggleMode} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  texts: {
    flex: 1,
    marginRight: 8,
  },
});

export default ThemeToggle;
