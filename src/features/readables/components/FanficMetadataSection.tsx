// src/features/readables/components/FanficMetadataSection.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import type { FanficReadable } from '../types';

interface FanficMetadataSectionProps {
  fanfic: FanficReadable;
  tagsExpanded: boolean;
  onToggleTags: () => void;
  onOpenAo3: () => void;
}

/**
 * AO3-specific metadata section for fanfics on the detail screen.
 */
const FanficMetadataSection: React.FC<FanficMetadataSectionProps> = ({
  fanfic,
  tagsExpanded,
  onToggleTags,
  onOpenAo3,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fanfic details</Text>

      {fanfic.wordCount != null && (
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>Word count: </Text>
          {fanfic.wordCount.toLocaleString()}
        </Text>
      )}

      {fanfic.rating && (
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>Rating: </Text>
          {fanfic.rating}
        </Text>
      )}

      {fanfic.complete != null && (
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>Complete: </Text>
          {fanfic.complete ? 'Yes' : 'No'}
        </Text>
      )}

      {fanfic.chapterCount != null && (
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>Chapters: </Text>
          {fanfic.chapterCount}
        </Text>
      )}

      {fanfic.fandoms.length > 0 && (
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Fandoms</Text>
          <View style={styles.tagChips}>
            {fanfic.fandoms.map((fandom) => (
              <Chip key={fandom} style={styles.tagChip}>
                {fandom}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {fanfic.relationships.length > 0 && (
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Relationships</Text>
          <View style={styles.tagChips}>
            {fanfic.relationships.map((rel) => (
              <Chip key={rel} style={styles.tagChip}>
                {rel}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {fanfic.characters.length > 0 && (
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Characters</Text>
          <View style={styles.tagChips}>
            {fanfic.characters.map((char) => (
              <Chip key={char} style={styles.tagChip}>
                {char}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {fanfic.ao3Tags.length > 0 && (
        <View style={styles.metaBlock}>
          <View style={styles.tagsHeaderRow}>
            <Text style={styles.metaLabel}>Tags</Text>
            <Button mode="text" compact onPress={onToggleTags}>
              {tagsExpanded ? 'Hide tags' : 'Show tags'}
            </Button>
          </View>
          {tagsExpanded && (
            <View style={styles.tagChips}>
              {fanfic.ao3Tags.map((tag) => (
                <Chip key={tag} style={styles.tagChip}>
                  {tag}
                </Chip>
              ))}
            </View>
          )}
        </View>
      )}

      {fanfic.warnings.length > 0 && (
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Warnings</Text>
          <View style={styles.tagChips}>
            {fanfic.warnings.map((warning) => (
              <Chip key={warning} style={styles.tagChip}>
                {warning}
              </Chip>
            ))}
          </View>
        </View>
      )}

      <Button mode="contained-tonal" style={styles.button} onPress={onOpenAo3}>
        Open on AO3
      </Button>
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
  metaText: {
    marginTop: 4,
  },
  metaLabel: {
    fontWeight: '600',
  },
  metaBlock: {
    marginTop: 8,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    marginTop: 8,
  },
});

export default FanficMetadataSection;
