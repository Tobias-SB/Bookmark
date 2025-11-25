// src/features/moods/components/MoodProfileCard.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import type { MoodProfile } from '../types';

interface Props {
  profile: MoodProfile;
  onSelect: () => void;
}

const MoodProfileCard: React.FC<Props> = ({ profile, onSelect }) => {
  return (
    <Card style={styles.card} onPress={onSelect}>
      <Card.Title title={profile.label} />
      <Card.Content>
        <View style={styles.chips}>
          {profile.tags.map((tag) => (
            <Chip key={tag} style={styles.chip}>
              {tag.replace('-', ' ')}
            </Chip>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 6,
    marginBottom: 6,
  },
});

export default MoodProfileCard;
