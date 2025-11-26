// src/features/settings/screens/SettingsScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import Screen from '@src/components/common/Screen';
import ThemeToggle from '../components/ThemeToggle';
import ThemeVariantSelector from '../components/ThemeVariantSelector';
import DataManagementSection from '../components/DataManagementSection';

const SettingsScreen: React.FC = () => {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall" style={styles.header}>
          Settings
        </Text>

        <ThemeToggle />
        <ThemeVariantSelector />
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
