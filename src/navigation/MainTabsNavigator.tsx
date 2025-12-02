// src/navigation/MainTabsNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'react-native-paper';

import type { MainTabsParamList } from './types';
import ReadableListScreen from '@src/features/readables/screens/ReadableListScreen';
import MoodSelectScreen from '@src/features/moods/screens/MoodSelectScreen';
import StatsScreen from '@src/features/stats/screens/StatsScreen';
import SettingsScreen from '@src/features/settings/screens/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

type TabRouteName = keyof MainTabsParamList;

interface TabIconProps {
  color: string;
  size: number;
}

/**
 * Map each tab route to an Ionicons name.
 */
function getTabIconName(routeName: TabRouteName): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'Library':
      return 'book-outline';
    case 'Discover':
      return 'bulb-outline';
    case 'Stats':
      return 'stats-chart-outline';
    case 'Settings':
      return 'settings-outline';
    default:
      return 'ellipse-outline';
  }
}

/**
 * Stable icon renderer factory, defined outside the component to satisfy
 * react/no-unstable-nested-components.
 */
function renderTabBarIcon(routeName: TabRouteName) {
  return ({ color, size }: TabIconProps) => (
    <Ionicons name={getTabIconName(routeName)} size={size} color={color} />
  );
}

const MainTabsNavigator: React.FC = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: renderTabBarIcon(route.name as TabRouteName),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: (theme.colors as any).onSurfaceDisabled ?? theme.colors.onSurface,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: (theme.colors as any).outlineVariant ?? theme.colors.outline,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen name="Library" component={ReadableListScreen} options={{ title: 'Library' }} />
      <Tab.Screen name="Discover" component={MoodSelectScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Stats' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainTabsNavigator;
