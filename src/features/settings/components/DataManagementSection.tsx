// src/features/settings/components/DataManagementSection.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

const DataManagementSection: React.FC = () => {
  const handleExport = () => {
    // Stub – in future, export DB to file or clipboard
  };

  const handleImport = () => {
    // Stub – in future, import DB from file
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Data management
      </Text>
      <Text variant="bodySmall" style={styles.subtitle}>
        Export or import your library (not implemented yet).
      </Text>
      <View style={styles.buttons}>
        <Button mode="outlined" onPress={handleExport} style={styles.button}>
          Export
        </Button>
        <Button mode="outlined" onPress={handleImport} style={styles.button}>
          Import
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
  },
  button: {
    marginRight: 8,
  },
});

export default DataManagementSection;
