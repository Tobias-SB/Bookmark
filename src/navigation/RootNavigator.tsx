// src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabsNavigator from './MainTabsNavigator';
import type { RootStackParamList } from './types';
import ReadableDetailScreen from '@src/features/readables/screens/ReadableDetailScreen';
import EditReadableScreen from '@src/features/readables/screens/EditReadableScreen';
import QuickAddReadableScreen from '@src/features/readables/screens/QuickAddReadableScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RootTabs"
        component={MainTabsNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QuickAddReadable"
        component={QuickAddReadableScreen}
        options={{ title: 'Add to library' }}
      />
      <Stack.Screen
        name="ReadableDetail"
        component={ReadableDetailScreen}
        options={{ title: 'Details' }}
      />
      <Stack.Screen
        name="EditReadable"
        component={EditReadableScreen}
        options={{ title: 'Readable details' }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
