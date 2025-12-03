// src/features/readables/components/FanficMetadataSection.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import type { FanficReadable } from '@src/features/readables/types';

interface FanficMetadataSectionProps {
  fanfic: FanficReadable;
  tagsExpanded: boolean;
  onToggleTags: () => void;
  onOpenAo3: () => void;
  onTagPress?: (tag: string) => void;
}

const FanficMetadataSection: React.FC<FanficMetadataSectionProps> = ({
  fanfic,
  tagsExpanded,
  onToggleTags,
  onOpenAo3,
  onTagPress,
}) => {
  const { rating, wordCount, chapterCount, complete, warnings } = fanfic;

  const hasAnyTags =
    fanfic.fandoms.length > 0 ||
    fanfic.relationships.length > 0 ||
    fanfic.characters.length > 0 ||
    fanfic.ao3Tags.length > 0 ||
    warnings.length > 0;

  const handleTagPress = (tag: string) => {
    onTagPress?.(tag);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fanfic metadata</Text>

      <View style={styles.row}>
        {rating && <Chip style={styles.chip}>Rating: {rating}</Chip>}
        {typeof wordCount === 'number' && (
          <Chip style={styles.chip}>{wordCount.toLocaleString()} words</Chip>
        )}
        {typeof chapterCount === 'number' && (
          <Chip style={styles.chip}>
            {chapterCount} chapter{chapterCount === 1 ? '' : 's'}
          </Chip>
        )}
        {complete != null && (
          <Chip style={styles.chip}>{complete ? 'Complete' : 'Work in progress'}</Chip>
        )}
      </View>

      {warnings.length > 0 && (
        <View style={styles.tagGroup}>
          <Text style={styles.tagGroupTitle}>Warnings</Text>
          <View style={styles.tagRow}>
            {warnings.map((tag) => (
              <Chip
                key={`warning-${tag}`}
                style={styles.tagChip}
                onPress={() => handleTagPress(tag)}
              >
                {tag}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {hasAnyTags && (
        <View style={styles.tagsHeaderRow}>
          <Text style={styles.tagsHeaderText}>
            {tagsExpanded ? 'Hide tags' : 'Show tags (fandoms, characters, etc.)'}
          </Text>
          <Button mode="text" onPress={onToggleTags}>
            {tagsExpanded ? 'Hide' : 'Show'}
          </Button>
        </View>
      )}

      {tagsExpanded && (
        <>
          {fanfic.fandoms.length > 0 && (
            <TagGroup label="Fandoms" tags={fanfic.fandoms} onTagPress={handleTagPress} />
          )}

          {fanfic.relationships.length > 0 && (
            <TagGroup
              label="Relationships"
              tags={fanfic.relationships}
              onTagPress={handleTagPress}
            />
          )}

          {fanfic.characters.length > 0 && (
            <TagGroup label="Characters" tags={fanfic.characters} onTagPress={handleTagPress} />
          )}

          {fanfic.ao3Tags.length > 0 && (
            <TagGroup label="Tags" tags={fanfic.ao3Tags} onTagPress={handleTagPress} />
          )}
        </>
      )}

      <Button mode="outlined" onPress={onOpenAo3} style={styles.ao3Button}>
        View on AO3
      </Button>
    </View>
  );
};

interface TagGroupProps {
  label: string;
  tags: string[];
  onTagPress?: (tag: string) => void;
}

const TagGroup: React.FC<TagGroupProps> = ({ label, tags, onTagPress }) => {
  if (tags.length === 0) return null;

  return (
    <View style={styles.tagGroup}>
      <Text style={styles.tagGroupTitle}>{label}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <Chip key={`${label}-${tag}`} style={styles.tagChip} onPress={() => onTagPress?.(tag)}>
            {tag}
          </Chip>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 4,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    marginRight: 6,
    marginBottom: 6,
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tagsHeaderText: {
    fontSize: 13,
    opacity: 0.8,
  },
  tagGroup: {
    marginTop: 8,
  },
  tagGroupTitle: {
    marginBottom: 4,
    fontWeight: '500',
    fontSize: 13,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  ao3Button: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
});

export default FanficMetadataSection;
