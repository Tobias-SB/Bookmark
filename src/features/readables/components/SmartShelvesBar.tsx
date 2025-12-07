import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import type { SmartShelf } from '@src/features/readables/types/smartShelves';

interface SmartShelvesBarProps {
  shelves: SmartShelf[];
  selectedShelfId: 'all' | string;
  onSelectAll: () => void;
  onSelectShelf: (shelf: SmartShelf) => void;
}

/**
 * Horizontal chip row for Smart Shelves.
 *
 * - Always shows an implicit "All" shelf.
 * - Then one chip per user-defined Smart Shelf.
 * - Selection is controlled via selectedShelfId.
 */
const SmartShelvesBar: React.FC<SmartShelvesBarProps> = ({
  shelves,
  selectedShelfId,
  onSelectAll,
  onSelectShelf,
}) => {
  const hasUserShelves = shelves.length > 0;

  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.label}>
        Shelves
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip
          key="all-shelf"
          style={styles.chip}
          selected={selectedShelfId === 'all'}
          onPress={onSelectAll}
        >
          All
        </Chip>

        {hasUserShelves &&
          shelves.map((shelf) => (
            <Chip
              key={shelf.id}
              style={styles.chip}
              selected={selectedShelfId === shelf.id}
              onPress={() => onSelectShelf(shelf)}
            >
              {shelf.name}
            </Chip>
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  label: {
    marginBottom: 4,
    opacity: 0.8,
  },
  chipsRow: {
    paddingBottom: 4,
  },
  chip: {
    marginRight: 8,
  },
});

export default SmartShelvesBar;
