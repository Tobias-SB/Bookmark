// src/features/readables/components/LibraryFilterBar.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { READABLE_STATUS_LABELS, type LibraryFilter } from '../types';

interface LibraryFilterBarProps {
  value: LibraryFilter;
  onChange: (next: LibraryFilter) => void;
}

const FILTERS: { key: LibraryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'to-read', label: READABLE_STATUS_LABELS['to-read'] },
  { key: 'reading', label: READABLE_STATUS_LABELS.reading },
  { key: 'finished', label: READABLE_STATUS_LABELS.finished },
  { key: 'DNF', label: READABLE_STATUS_LABELS.DNF },
];

/**
 * Horizontal chip bar used on the Library screen to filter
 * by reading status (or show all).
 */
const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({ value, onChange }) => {
  return (
    <View style={styles.container}>
      {FILTERS.map((f) => (
        <Chip
          key={f.key}
          style={styles.chip}
          selected={value === f.key}
          onPress={() => onChange(f.key)}
        >
          {f.label}
        </Chip>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chip: {
    marginRight: 6,
    marginBottom: 6,
  },
});

export default LibraryFilterBar;
