// src/app/navigation/RootNavigator.tsx
// §7 — Root stack: MainTabs (tab navigator) + ReadableDetail and AddEditReadable
// as modal stack screens. Tab bar is hidden on modal screens automatically
// because they live in the stack above the tab navigator.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { ReadableDetailScreen, AddEditScreen } from '../../features/readables';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReadableDetail"
        component={ReadableDetailScreen}
        options={{ presentation: 'modal', title: 'Detail' }}
      />
      <Stack.Screen
        name="AddEditReadable"
        component={AddEditScreen}
        options={{ presentation: 'modal', title: 'Add / Edit' }}
      />
    </Stack.Navigator>
  );
}
