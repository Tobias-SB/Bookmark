// src/app/navigation/TabNavigator.tsx
// §7 — Library and Settings tabs. Tab bar labels only — no icons (see Phase 4 note).

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { TabParamList } from './types';
import { LibraryScreen } from '../../features/readables';
import { SettingsScreen } from '../../features/settings';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: 'Library' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}
