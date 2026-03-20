// src/features/settings/ui/SettingsScreen.tsx
// UI Phase 7 — SettingsScreen redesign.
// Floating section cards with custom display-mode chip selector.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeContext } from '../../../app/theme';
import type { ColorMode } from '../../../app/theme';

// ── Local helpers ─────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: theme.colors.backgroundCard,
          ...theme.shadows.card,
        },
      ]}
    >
      {children}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        cardStyles.sectionHeader,
        { borderBottomColor: theme.colors.backgroundInput },
      ]}
    >
      <Text style={[cardStyles.sectionHeaderText, { color: theme.colors.textMeta }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 14,
    marginBottom: 9,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

const COLOR_MODES: { value: ColorMode; label: string; a11yLabel: string }[] = [
  { value: 'system', label: 'System', a11yLabel: 'Follow system display mode' },
  { value: 'light', label: 'Light', a11yLabel: 'Light mode' },
  { value: 'dark', label: 'Dark', a11yLabel: 'Dark mode' },
];

export function SettingsScreen() {
  const theme = useAppTheme();
  const { colorMode, setColorMode } = useThemeContext();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.backgroundPage }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader title="Appearance" />
        <View style={styles.cardBody}>
          <Text style={[styles.rowLabel, { color: theme.colors.textBody }]}>
            Display mode
          </Text>
          <View style={styles.modeRow}>
            {COLOR_MODES.map(({ value, label, a11yLabel }) => {
              const active = colorMode === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => void setColorMode(value)}
                  style={[
                    styles.modeButton,
                    active
                      ? {
                          backgroundColor: theme.colors.kindBookSubtle,
                          borderColor: theme.colors.kindBookBorder,
                        }
                      : {
                          backgroundColor: theme.colors.backgroundInput,
                          borderColor: theme.colors.backgroundBorder,
                        },
                  ]}
                  accessibilityLabel={a11yLabel}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      {
                        color: active ? theme.colors.kindBook : theme.colors.textBody,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SectionCard>

      {/* ── Coming soon ─────────────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader title="Library" />
        <View style={styles.cardBody}>
          {(['Backup & restore', 'Export to CSV'] as const).map((label) => (
            <View key={label} style={[styles.comingSoonRow, { borderBottomColor: theme.colors.backgroundInput }]}>
              <Text style={[styles.comingSoonLabel, { color: theme.colors.textBody }]}>
                {label}
              </Text>
              <View style={[styles.comingSoonBadge, { backgroundColor: theme.colors.backgroundInput, borderColor: theme.colors.backgroundBorder }]}>
                <Text style={[styles.comingSoonBadgeText, { color: theme.colors.textMeta }]}>
                  Coming soon
                </Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 14,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    fontSize: 13,
  },
  comingSoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  comingSoonLabel: {
    fontSize: 14,
  },
  comingSoonBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  comingSoonBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
