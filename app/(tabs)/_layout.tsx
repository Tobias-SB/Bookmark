import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useWindowDimensions } from 'react-native';

import { NAV_RAIL_MIN_WIDTH, NavRail } from '@/shared/components/NavRail';
import { TabBar } from '@/shared/components/TabBar';
import { TabItem } from '@/shared/components/TabItem';
import { t, type TranslationKey } from '@/shared/i18n';

const TABS = [
  { name: 'index', href: '/', label: 'tabs.home' },
  { name: 'library', href: '/library', label: 'tabs.library' },
  { name: 'shelves', href: '/shelves', label: 'tabs.shelves' },
  { name: 'updates', href: '/updates', label: 'tabs.updates' },
  { name: 'settings', href: '/settings', label: 'tabs.settings' },
] as const satisfies readonly { name: string; href: string; label: TranslationKey }[];

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= NAV_RAIL_MIN_WIDTH;
  const Nav = isWide ? NavRail : TabBar;

  // Expo Router reads the triggers from this element tree, so they must stay inline here.
  const nav = (
    <TabList asChild>
      <Nav>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabItem label={t(tab.label)} layout={isWide ? 'rail' : 'bar'} />
          </TabTrigger>
        ))}
      </Nav>
    </TabList>
  );

  return (
    <Tabs style={{ flex: 1, flexDirection: isWide ? 'row' : 'column' }}>
      {isWide && nav}
      <TabSlot />
      {!isWide && nav}
    </Tabs>
  );
}
