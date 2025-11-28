// src/features/moods/components/MoodTagSelector.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import MoodChip from './MoodChip';
import { ALL_MOOD_TAGS, type MoodTag } from '../types';

interface MoodTagSelectorProps {
  selected: MoodTag[];
  onChange: (next: MoodTag[]) => void;
  title?: string;
  showClearButton?: boolean;
}

/**
 * Reusable selector for mood tags:
 * - Renders all ALL_MOOD_TAGS as chips.
 * - Handles toggle logic.
 * - Optional title + "Clear moods" button.
 */
const MoodTagSelector: React.FC<MoodTagSelectorProps> = ({
  selected,
  onChange,
  title,
  showClearButton = false,
}) => {
  const handleToggle = (tag: MoodTag) => {
    const hasTag = selected.includes(tag);
    if (hasTag) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <View>
      {title ? (
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {title}
        </Text>
      ) : null}

      <View style={styles.chipsContainer}>
        {ALL_MOOD_TAGS.map((tag) => (
          <MoodChip key={tag} tag={tag} selected={selected.includes(tag)} onToggle={handleToggle} />
        ))}
      </View>

      {showClearButton && (
        <View style={styles.clearRow}>
          <Button mode="text" onPress={handleClear}>
            Clear moods
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  clearRow: {
    marginTop: 8,
  },
});

export default MoodTagSelector;
