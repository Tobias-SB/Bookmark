// src/features/moods/components/MoodChip.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import type { MoodTag } from '../types';

interface MoodChipProps {
  tag: MoodTag;
  selected: boolean;
  onToggle: (tag: MoodTag) => void;
}

const MoodChip: React.FC<MoodChipProps> = ({ tag, selected, onToggle }) => {
  return (
    <Chip style={styles.chip} selected={selected} onPress={() => onToggle(tag)}>
      {tag.replace('-', ' ')}
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    marginRight: 6,
    marginBottom: 6,
  },
});

export default MoodChip;
