// src/app/navigation/TabNavigator.tsx
// §7 — Single Library tab. v1 has one tab — do not add more unless explicitly requested.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { TabParamList } from './types';
import { LibraryScreen } from '../../features/readables';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: 'Library' }}
      />
    </Tab.Navigator>
  );
}
