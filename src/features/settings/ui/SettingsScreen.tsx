// src/features/settings/ui/SettingsScreen.tsx
// UI Phase 7 — SettingsScreen redesign.
// Floating section cards with custom display-mode chip selector.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppTheme, useThemeContext } from '../../../app/theme';
import type { ColorMode } from '../../../app/theme';
import { useAo3Session, useAo3Login, useAo3Logout } from '../../ao3Auth';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useExportCsv } from '../../import';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { isLoggedIn } = useAo3Session();
  const { navigateToLogin } = useAo3Login();
  const { logout, isLoggingOut } = useAo3Logout();

  const { exportCsv, isExporting, snackbarMessage, hideSnackbar } = useExportCsv();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}>
      <ScreenHeader title="Settings" />

      <ScrollView
        style={styles.scroll}
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

        {/* ── AO3 Account ─────────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="AO3 Account" />
          <View style={styles.cardBody}>
            {isLoggedIn ? (
              <View
                style={[
                  styles.accountRow,
                  { borderBottomColor: theme.colors.backgroundInput },
                ]}
              >
                <Text style={[styles.accountLabel, { color: theme.colors.textBody }]}>
                  Logged in to AO3
                </Text>
                <TouchableOpacity
                  onPress={() => void logout()}
                  disabled={isLoggingOut}
                  style={[
                    styles.logoutButton,
                    {
                      backgroundColor: theme.colors.backgroundInput,
                      borderColor: theme.colors.backgroundBorder,
                    },
                  ]}
                  accessibilityLabel="Log out of AO3"
                  accessibilityRole="button"
                >
                  {isLoggingOut ? (
                    <ActivityIndicator size={14} color={theme.colors.textMeta} />
                  ) : (
                    <Text style={[styles.logoutButtonText, { color: theme.colors.textBody }]}>
                      Log out
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={navigateToLogin}
                style={[
                  styles.accountRow,
                  { borderBottomColor: theme.colors.backgroundInput },
                ]}
                accessibilityLabel="Log in to AO3"
                accessibilityRole="button"
              >
                <Text style={[styles.accountLabel, { color: theme.colors.textBody }]}>
                  Log in to AO3
                </Text>
                <Text style={[styles.accountChevron, { color: theme.colors.textMeta }]}>
                  ›
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.accountHint, { color: theme.colors.textHint }]}>
              Log in to import and refresh restricted AO3 works.
            </Text>
          </View>
        </SectionCard>

        {/* ── Library ─────────────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader title="Library" />
          <View style={styles.cardBody}>
            {/* Import from CSV */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ImportCsv')}
              style={[styles.navRow, { borderBottomColor: theme.colors.backgroundInput }]}
              accessibilityLabel="Import from CSV"
              accessibilityRole="button"
            >
              <Text style={[styles.navRowLabel, { color: theme.colors.textBody }]}>
                Import from CSV
              </Text>
              <Text style={[styles.navRowChevron, { color: theme.colors.textMeta }]}>
                ›
              </Text>
            </TouchableOpacity>

            {/* Export to CSV */}
            <TouchableOpacity
              onPress={() => void exportCsv()}
              disabled={isExporting}
              style={[
                styles.navRow,
                { borderBottomColor: theme.colors.backgroundInput },
              ]}
              accessibilityLabel="Export library to CSV"
              accessibilityRole="button"
              accessibilityState={{ disabled: isExporting }}
            >
              <Text style={[styles.navRowLabel, { color: theme.colors.textBody }]}>
                Export to CSV
              </Text>
              {isExporting ? (
                <ActivityIndicator size={16} color={theme.colors.textMeta} />
              ) : (
                <Text style={[styles.navRowChevron, { color: theme.colors.textMeta }]}>
                  ›
                </Text>
              )}
            </TouchableOpacity>

            {/* Backup & restore — coming soon */}
            <View style={[styles.comingSoonRow, { borderBottomColor: theme.colors.backgroundInput }]}>
              <Text style={[styles.comingSoonLabel, { color: theme.colors.textBody }]}>
                Backup &amp; restore
              </Text>
              <View style={[styles.comingSoonBadge, { backgroundColor: theme.colors.backgroundInput, borderColor: theme.colors.backgroundBorder }]}>
                <Text style={[styles.comingSoonBadgeText, { color: theme.colors.textMeta }]}>
                  Coming soon
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

      </ScrollView>

      <Portal>
        <Snackbar
          visible={snackbarMessage !== null}
          onDismiss={hideSnackbar}
          duration={4000}
        >
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
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
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderBottomWidth: 1,
  },
  accountLabel: {
    fontSize: 14,
  },
  accountChevron: {
    fontSize: 20,
    lineHeight: 22,
  },
  accountHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  navRowLabel: {
    fontSize: 14,
  },
  navRowChevron: {
    fontSize: 20,
    lineHeight: 22,
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
