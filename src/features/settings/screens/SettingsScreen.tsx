// src/features/settings/screens/SettingsScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Screen from '@src/components/common/Screen';
import { Text } from 'react-native-paper';
import ThemeToggle from '../components/ThemeToggle';
import DataManagementSection from '../components/DataManagementSection';

const SettingsScreen: React.FC = () => {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall" style={styles.header}>
          Settings
        </Text>

        <ThemeToggle />
        <DataManagementSection />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
});

export default SettingsScreen;
