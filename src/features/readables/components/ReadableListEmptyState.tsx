// src/features/readables/components/ReadableListEmptyState.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import PrimaryButton from '@src/components/common/PrimaryButton';

interface Props {
  onAdd: () => void;
}

const ReadableListEmptyState: React.FC<Props> = ({ onAdd }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Your library is empty.</Text>
      <Text style={styles.text}>Add a book or fic to get started.</Text>
      <View style={styles.buttonWrapper}>
        <PrimaryButton label="Add readable" onPress={onAdd} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
  buttonWrapper: {
    marginTop: 16,
  },
});

export default ReadableListEmptyState;
