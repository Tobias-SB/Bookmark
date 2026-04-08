// src/app/navigation/TabNavigator.tsx
// §7 — Library, Updates, and Settings tabs with Material Community Icons.
// @expo/vector-icons is a transitive dependency of the expo package (SDK 55).
//
// The Updates tab badge displays the unread WipUpdate count.
// useUnreadWipUpdateCount() is called directly here since TabNavigator is a
// React component inside QueryClientProvider and DatabaseProvider.
//
// UI Phase 2: tab bar uses semantic tokens; bottom gradient via expo-linear-gradient.

import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import type { TabParamList } from './types';
import { useAppTheme } from '../../app/theme';
import { LibraryScreen } from '../../features/readables';
import { SettingsScreen } from '../../features/settings';
import { UpdatesScreen, useUnreadWipUpdateCount } from '../../features/wipUpdates';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const unreadCount = useUnreadWipUpdateCount();
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.kindBook,
        tabBarInactiveTintColor: theme.colors.textMeta,
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: theme.colors.tabBarGradientEnd,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={[theme.colors.backgroundPage, theme.colors.tabBarGradientEnd]}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: 'Library',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon source="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Updates"
        component={UpdatesScreen}
        options={{
          title: 'Updates',
          tabBarIcon: ({ color, size }) => (
            <Icon source="bell-outline" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon source="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
