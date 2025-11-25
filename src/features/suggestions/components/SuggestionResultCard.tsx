// src/features/suggestions/components/SuggestionResultCard.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@src/navigation/types';
import type { SuggestionResult } from '@src/store/useUiStore';

type RootNav = NavigationProp<RootStackParamList>;

interface Props {
  result: SuggestionResult;
}

const SuggestionResultCard: React.FC<Props> = ({ result }) => {
  const navigation = useNavigation<RootNav>();
  const { item, score, reason } = result;

  const handleViewDetails = () => {
    navigation.navigate('ReadableDetail', { id: item.id });
  };

  return (
    <Card style={styles.card}>
      <Card.Title
        title={item.title}
        subtitle={`${item.author} • ${item.type === 'book' ? 'Book' : 'Fanfic'}`}
      />
      <Card.Content>
        <Text variant="bodyMedium" style={styles.meta}>
          Priority {item.priority} • Score {score.toFixed(1)}
        </Text>
        <Text variant="bodySmall" style={styles.reason}>
          {reason}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={handleViewDetails}>View details</Button>
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
  },
  meta: {
    marginBottom: 4,
  },
  reason: {
    marginTop: 4,
  },
});

export default SuggestionResultCard;
