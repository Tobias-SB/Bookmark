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
//
// ReadableDetail uses headerShown: false — the screen manages its own back bar and
// status bar via a hero gradient that bleeds into the status bar area.
//
// Feature 6: ShareHandler is a transparentModal that slides up as a bottom sheet
// when the user shares an AO3 URL from another app. ShareIntentHandler is a
// headless component (returns null) rendered as a sibling of Stack.Navigator —
// it is inside NavigationContainer so useNavigation() resolves correctly.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { ReadableDetailScreen, AddEditScreen, QuickAddScreen } from '../../features/readables';
import { Ao3LoginScreen } from '../../features/ao3Auth';
import { ShareHandlerScreen, ShareIntentHandler } from '../../features/shareHandler';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReadableDetail"
          component={ReadableDetailScreen}
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="QuickAddReadable"
          component={QuickAddScreen}
          options={{ presentation: 'modal', title: 'Add to Library' }}
        />
        <Stack.Screen
          name="AddEditReadable"
          component={AddEditScreen}
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="Ao3Login"
          component={Ao3LoginScreen}
          options={{ presentation: 'modal', title: 'Log in to AO3' }}
        />
        <Stack.Screen
          name="ShareHandler"
          component={ShareHandlerScreen}
          options={{ presentation: 'transparentModal', headerShown: false }}
        />
      </Stack.Navigator>
      {/* Headless intent handler — listens for share intents and navigates to ShareHandler. */}
      <ShareIntentHandler />
    </>
  );
}
