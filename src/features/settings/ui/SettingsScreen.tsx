// src/features/settings/ui/SettingsScreen.tsx
// NOTE: This establishes the settings feature module pattern in src/features/settings/.

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List, SegmentedButtons } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeContext } from '../../../app/theme';
import type { ColorMode } from '../../../app/theme';

export function SettingsScreen() {
  const theme = useAppTheme();
  const { colorMode, setColorMode } = useThemeContext();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.textSecondary }}>
          Appearance
        </List.Subheader>
        <List.Subheader style={[styles.groupLabel, { color: theme.colors.textDisabled }]}>
          Display mode
        </List.Subheader>
        <SegmentedButtons
          style={styles.modeButtons}
          value={colorMode}
          onValueChange={(v) => void setColorMode(v as ColorMode)}
          buttons={[
            { value: 'system', label: 'System', accessibilityLabel: 'Follow system display mode' },
            { value: 'light', label: 'Light', accessibilityLabel: 'Light mode' },
            { value: 'dark', label: 'Dark', accessibilityLabel: 'Dark mode' },
          ]}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  modeButtons: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 11,
    paddingTop: 0,
  },
});
