import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const NAV_RAIL_MIN_WIDTH = 900;

// Side navigation at 900 px and wider (spec §12.1). Used as the child of `<TabList asChild>`.
export function NavRail({ children }: { children?: ReactNode }) {
  const { top, bottom, left } = useSafeAreaInsets();
  return (
    <View
      role="tablist"
      testID="nav-rail"
      className="w-24 gap-2 border-r border-outline bg-surface px-2"
      style={{ paddingTop: top + 8, paddingBottom: bottom + 8, paddingLeft: left + 8 }}
    >
      {children}
    </View>
  );
}
