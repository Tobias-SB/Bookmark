// src/shared/components/ScreenHeader.tsx
// Shared large-title screen header for tab screens that opt out of the
// React Navigation system header (headerShown: false).
//
// Matches the collapsed-header aesthetic used by LibraryScreen:
// backgroundPage fill, large title at theme.typography.titleLg, safe-area aware.
//
// Usage:
//   <ScreenHeader title="Updates" />
//   <ScreenHeader title="Settings" right={<SomeButton />} />

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../app/theme';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  title: string;
  /** Optional element rendered at the trailing edge (icon button, badge, etc.). */
  right?: React.ReactNode;
}

export function ScreenHeader({ title, right }: Props): React.JSX.Element {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          backgroundColor: theme.colors.backgroundPage,
        },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={[styles.title, { color: theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {right != null && <View style={styles.rightSlot}>{right}</View>}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,      // = theme.typography.titleLg
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  rightSlot: {
    marginLeft: 12,
    flexShrink: 0,
  },
});
