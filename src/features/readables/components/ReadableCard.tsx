// src/features/readables/components/ReadableCard.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import type { ReadableItem } from '@src/features/readables/types';

interface ReadableCardProps {
  item: ReadableItem;
  onPress: () => void;
}

const ReadableCard: React.FC<ReadableCardProps> = ({ item, onPress }) => {
  const typeLabel = item.type === 'book' ? 'Book' : 'Fanfic';

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title title={item.title} subtitle={item.author} />
      <Card.Content>
        <Text numberOfLines={2} style={styles.description}>
          {item.description || 'No description'}
        </Text>
        <Text style={styles.priority}>Priority: {item.priority}</Text>
        <Chip style={styles.chip}>{typeLabel}</Chip>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 4,
  },
  priority: {
    marginBottom: 8,
  },
  chip: {
    alignSelf: 'flex-start',
  },
});

export default ReadableCard;
