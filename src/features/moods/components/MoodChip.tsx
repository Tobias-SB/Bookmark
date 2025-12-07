import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import type { MoodTag } from '../types';
import { getMoodDefinition } from '../types';

interface MoodChipProps {
  tag: MoodTag;
  selected: boolean;
  onToggle: (tag: MoodTag) => void;
}

const MoodChip: React.FC<MoodChipProps> = ({ tag, selected, onToggle }) => {
  const mood = getMoodDefinition(tag);

  return (
    <Chip style={styles.chip} selected={selected} onPress={() => onToggle(tag)}>
      {mood.label}
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
