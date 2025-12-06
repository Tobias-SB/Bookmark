// src/features/readables/components/FanficMetadataSection.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import type { FanficReadable, Ao3Rating } from '@src/features/readables/types';

interface FanficMetadataSectionProps {
  fanfic: FanficReadable;
  tagsExpanded: boolean;
  onToggleTags: () => void;
  onOpenAo3: () => void;
  onTagPress: (tag: string) => void;
}

function mapAo3RatingToLabel(rating: Ao3Rating): string {
  switch (rating) {
    case 'G':
      return 'General Audiences';
    case 'T':
      return 'Teen and Up';
    case 'M':
      return 'Mature';
    case 'E':
      return 'Explicit';
    case 'NR':
      return 'Not Rated';
    default:
      return rating;
  }
}

const FanficMetadataSection: React.FC<FanficMetadataSectionProps> = ({
  fanfic,
  tagsExpanded,
  onToggleTags,
  onOpenAo3,
  onTagPress,
}) => {
  const { fandoms, relationships, characters, ao3Tags, warnings, rating, complete, wordCount } =
    fanfic;

  const hasAnyTags =
    (fandoms && fandoms.length > 0) ||
    (relationships && relationships.length > 0) ||
    (characters && characters.length > 0) ||
    (warnings && warnings.length > 0) ||
    (ao3Tags && ao3Tags.length > 0);

  const effectiveCompletionLabel = complete === true ? 'Complete' : 'Work in Progress';

  const handleRatingChipPress = () => {
    if (!rating) return;
    const label = mapAo3RatingToLabel(rating);
    onTagPress(label);
  };

  const handleCompletionChipPress = () => {
    onTagPress(effectiveCompletionLabel);
  };

  return (
    <View style={styles.section}>
      {/* AO3 button above section title */}
      <View style={styles.ao3ButtonContainer}>
        <Button mode="contained" onPress={onOpenAo3} contentStyle={styles.ao3ButtonContent}>
          View on AO3
        </Button>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Fanfic details</Text>
      </View>

      {/* Core metadata chips: rating + completion + word count (always visible) */}
      <View style={styles.chipRow}>
        {rating ? (
          <Chip
            style={styles.chip}
            onPress={handleRatingChipPress}
            accessibilityRole="button"
            accessibilityLabel={`Filter by rating ${mapAo3RatingToLabel(rating)}`}
          >
            Rating: {mapAo3RatingToLabel(rating)}
          </Chip>
        ) : null}

        <Chip
          style={styles.chip}
          onPress={handleCompletionChipPress}
          accessibilityRole="button"
          accessibilityLabel={`Filter by ${effectiveCompletionLabel}`}
        >
          {effectiveCompletionLabel}
        </Chip>

        {typeof wordCount === 'number' && wordCount > 0 ? (
          <Chip style={styles.chip}>{wordCount.toLocaleString()} words</Chip>
        ) : null}
      </View>

      {/* Collapsible tag block: fandoms, relationships, characters, warnings, AO3 tags */}
      {hasAnyTags ? (
        <View style={styles.tagsSection}>
          <View style={styles.tagsHeaderRow}>
            <Text style={styles.groupLabel}>Tags</Text>
            <Button compact mode="text" onPress={onToggleTags}>
              {tagsExpanded ? 'Hide tags' : 'Show tags'}
            </Button>
          </View>

          {tagsExpanded ? (
            <View>
              {/* Fandoms */}
              {fandoms && fandoms.length > 0 ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabelSmall}>Fandoms</Text>
                  <View style={styles.chipRowWrap}>
                    {fandoms.map((fandom) => (
                      <Chip
                        key={fandom}
                        style={styles.smallChip}
                        onPress={() => onTagPress(fandom)}
                      >
                        {fandom}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Relationships */}
              {relationships && relationships.length > 0 ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabelSmall}>Relationships</Text>
                  <View style={styles.chipRowWrap}>
                    {relationships.map((rel) => (
                      <Chip key={rel} style={styles.smallChip} onPress={() => onTagPress(rel)}>
                        {rel}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Characters */}
              {characters && characters.length > 0 ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabelSmall}>Characters</Text>
                  <View style={styles.chipRowWrap}>
                    {characters.map((ch) => (
                      <Chip key={ch} style={styles.smallChip} onPress={() => onTagPress(ch)}>
                        {ch}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Warnings */}
              {warnings && warnings.length > 0 ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabelSmall}>Warnings</Text>
                  <View style={styles.chipRowWrap}>
                    {warnings.map((w) => (
                      <Chip
                        key={w}
                        style={[styles.smallChip, styles.warningChip]}
                        onPress={() => onTagPress(w)}
                      >
                        {w}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* AO3 freeform tags */}
              {ao3Tags && ao3Tags.length > 0 ? (
                <View style={styles.group}>
                  <Text style={styles.groupLabelSmall}>Additional tags</Text>
                  <View style={styles.chipRowWrap}>
                    {ao3Tags.map((tag) => (
                      <Chip key={tag} style={styles.smallChip} onPress={() => onTagPress(tag)}>
                        {tag}
                      </Chip>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '500',
  },
  ao3ButtonContainer: {
    alignSelf: 'stretch',
    paddingVertical: 4,
    marginBottom: 4,
  },
  ao3ButtonContent: {
    paddingVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  smallChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  tagsSection: {
    marginTop: 4,
  },
  group: {
    marginTop: 4,
  },
  groupLabel: {
    fontWeight: '500',
  },
  groupLabelSmall: {
    fontWeight: '500',
    marginBottom: 4,
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  warningChip: {
    opacity: 0.9,
  },
  tagsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
});

export default FanficMetadataSection;
