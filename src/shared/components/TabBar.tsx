import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Bottom navigation below 900 px wide (spec §12.1). Used as the child of `<TabList asChild>`.
export function TabBar({ children }: { children?: ReactNode }) {
  const { bottom, left, right } = useSafeAreaInsets();
  return (
    <View
      role="tablist"
      testID="tab-bar"
      className="flex-row gap-1 border-t border-outline bg-surface pt-1"
      style={{ paddingBottom: bottom + 4, paddingLeft: left + 8, paddingRight: right + 8 }}
    >
      {children}
    </View>
  );
}
