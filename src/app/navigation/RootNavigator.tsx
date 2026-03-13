// src/app/navigation/RootNavigator.tsx
// §7 — Root stack: MainTabs (tab navigator) + ReadableDetail, QuickAddReadable,
// and AddEditReadable as modal stack screens.
//
// Add flow: Library (FAB) → QuickAddReadable (modal) → AddEditReadable (modal).
// After a successful save, AddEditReadable calls navigation.popToTop() to dismiss
// both modals and return to Library in one motion.
//
// Edit flow: ReadableDetail → AddEditReadable (modal). After save, goBack() returns
// to ReadableDetail.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { ReadableDetailScreen, AddEditScreen, QuickAddScreen } from '../../features/readables';

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
        options={{ presentation: 'modal', title: '' }}
      />
      <Stack.Screen
        name="QuickAddReadable"
        component={QuickAddScreen}
        options={{ presentation: 'modal', title: 'Add to Library' }}
      />
      <Stack.Screen
        name="AddEditReadable"
        component={AddEditScreen}
        options={({ route }) => ({
          presentation: 'modal',
          title: route.params?.id !== undefined
            ? 'Edit'
            : route.params?.prefill?.kind === 'fanfic' ? 'Add Fanfic' : 'Add Book',
        })}
      />
    </Stack.Navigator>
  );
}
