// src/features/settings/ui/SettingsScreen.tsx
// NOTE: This establishes the settings feature module pattern in src/features/settings/.

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, List, SegmentedButtons, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeContext } from '../../../app/theme';
import type { ThemeName } from '../../../app/theme';

// ── Coming soon item ──────────────────────────────────────────────────────────
// Reused for all placeholder features so the badge style is defined once.

interface ComingSoonItemProps {
  title: string;
  description: string;
  accessibilityLabel: string;
}

function ComingSoonItem({ title, description, accessibilityLabel }: ComingSoonItemProps) {
  const theme = useAppTheme();
  return (
    <List.Item
      title={title}
      description={description}
      disabled
      titleStyle={{ color: theme.colors.textDisabled }}
      descriptionStyle={{ color: theme.colors.textDisabled }}
      right={() => (
        <Text
          variant="labelSmall"
          style={[styles.comingSoonBadge, { color: theme.colors.textDisabled }]}
        >
          Coming soon
        </Text>
      )}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const theme = useAppTheme();
  const { themeName, setTheme } = useThemeContext();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.textSecondary }}>
          Appearance
        </List.Subheader>
        <View style={styles.themeBlock}>
          <Text variant="bodyMedium" style={{ color: theme.colors.textSecondary }}>
            Theme
          </Text>
          <SegmentedButtons
            value={themeName}
            onValueChange={(v) => void setTheme(v as ThemeName)}
            buttons={[
              { value: 'light', label: 'Light', accessibilityLabel: 'Light theme' },
              { value: 'dark', label: 'Dark', accessibilityLabel: 'Dark theme' },
            ]}
            accessibilityLabel="Select app theme"
          />
        </View>
      </List.Section>

      <Divider />

      {/* ── Data Management — coming soon ────────────────────────────────── */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.textSecondary }}>
          Data Management
        </List.Subheader>
        <ComingSoonItem
          title="Import from Goodreads"
          description="Import your library from a Goodreads CSV export"
          accessibilityLabel="Import from Goodreads, coming soon"
        />
        <ComingSoonItem
          title="Export to Goodreads CSV"
          description="Export your library in Goodreads-compatible format"
          accessibilityLabel="Export to Goodreads CSV, coming soon"
        />
      </List.Section>

      <Divider />

      {/* ── Theme Customization — coming soon ────────────────────────────── */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.textSecondary }}>
          Theme Customization
        </List.Subheader>
        <ComingSoonItem
          title="Custom themes"
          description="Create and apply your own colour themes"
          accessibilityLabel="Custom themes, coming soon"
        />
        <ComingSoonItem
          title="Theme generator"
          description="Generate a colour theme from an image or colour picker"
          accessibilityLabel="Theme generator, coming soon"
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  themeBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  comingSoonBadge: {
    alignSelf: 'center',
    marginRight: 8,
  },
});
