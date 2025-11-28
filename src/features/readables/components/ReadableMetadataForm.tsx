// src/features/readables/components/ReadableMetadataForm.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, SegmentedButtons, Switch } from 'react-native-paper';
import { Control } from 'react-hook-form';

import TextInputField from '@src/components/common/TextInputField';
import TagListEditor from '@src/features/readables/components/TagListEditor';
import type { Ao3Rating, ReadableType } from '../types';

type FieldName =
  | 'title'
  | 'author'
  | 'description'
  | 'priority'
  | 'pageCount'
  | 'ao3Url'
  | 'wordCount'
  | 'chapterCount';

interface FieldConfig {
  name: FieldName;
  label: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}

const COMMON_FIELDS: FieldConfig[] = [
  { name: 'title', label: 'Title' },
  { name: 'author', label: 'Author' },
  { name: 'description', label: 'Description', multiline: true },
  { name: 'priority', label: 'Priority (1–5)', keyboardType: 'numeric' },
];

const BOOK_FIELDS: FieldConfig[] = [
  { name: 'pageCount', label: 'Page count', keyboardType: 'numeric' },
];

const FANFIC_FIELDS: FieldConfig[] = [
  { name: 'ao3Url', label: 'AO3 URL' },
  { name: 'wordCount', label: 'Word count', keyboardType: 'numeric' },
  { name: 'chapterCount', label: 'Chapter count', keyboardType: 'numeric' },
];

interface ReadableMetadataFormProps {
  type: ReadableType;
  control: Control<any>;

  // Book list fields
  genres: string[];
  onChangeGenres: (tags: string[]) => void;

  // Fanfic list fields
  fandoms: string[];
  onChangeFandoms: (tags: string[]) => void;
  relationships: string[];
  onChangeRelationships: (tags: string[]) => void;
  characters: string[];
  onChangeCharacters: (tags: string[]) => void;
  ao3Tags: string[];
  onChangeAo3Tags: (tags: string[]) => void;
  warnings: string[];
  onChangeWarnings: (tags: string[]) => void;

  // Fanfic scalar extras
  completeValue: boolean;
  onChangeComplete: (value: boolean) => void;
  currentRating: Ao3Rating | null;
  onChangeRating: (value: Ao3Rating | null) => void;
}

/**
 * Metadata-driven form for both book and fanfic readables.
 * Screens provide react-hook-form control + the tag arrays;
 * this component handles all the UI rendering.
 */
const ReadableMetadataForm: React.FC<ReadableMetadataFormProps> = ({
  type,
  control,
  genres,
  onChangeGenres,
  fandoms,
  onChangeFandoms,
  relationships,
  onChangeRelationships,
  characters,
  onChangeCharacters,
  ao3Tags,
  onChangeAo3Tags,
  warnings,
  onChangeWarnings,
  completeValue,
  onChangeComplete,
  currentRating,
  onChangeRating,
}) => {
  const renderField = (field: FieldConfig) => (
    <View style={styles.field} key={field.name}>
      <TextInputField<any>
        control={control}
        name={field.name as any}
        label={field.label}
        multiline={field.multiline}
        keyboardType={field.keyboardType}
      />
    </View>
  );

  return (
    <View>
      {/* common to both types */}
      {COMMON_FIELDS.map(renderField)}

      {type === 'book' ? (
        <>
          {BOOK_FIELDS.map(renderField)}
          <TagListEditor label="Genres" tags={genres} onChangeTags={onChangeGenres} />
        </>
      ) : (
        <>
          {FANFIC_FIELDS.map(renderField)}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Fanfic metadata
          </Text>

          <TagListEditor label="Fandoms" tags={fandoms} onChangeTags={onChangeFandoms} />
          <TagListEditor
            label="Relationships"
            tags={relationships}
            onChangeTags={onChangeRelationships}
          />
          <TagListEditor label="Characters" tags={characters} onChangeTags={onChangeCharacters} />
          <TagListEditor label="Tags" tags={ao3Tags} onChangeTags={onChangeAo3Tags} />
          <TagListEditor label="Warnings" tags={warnings} onChangeTags={onChangeWarnings} />

          <View style={styles.toggleRow}>
            <Text>Marked complete</Text>
            <Switch value={completeValue} onValueChange={onChangeComplete} />
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            AO3 rating
          </Text>
          <SegmentedButtons
            value={currentRating ?? ''}
            onValueChange={(value) => onChangeRating((value || null) as Ao3Rating | null)}
            buttons={[
              { value: 'G', label: 'G' },
              { value: 'T', label: 'T' },
              { value: 'M', label: 'M' },
              { value: 'E', label: 'E' },
              { value: 'NR', label: 'NR' },
            ]}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    marginTop: 12,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 4,
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default ReadableMetadataForm;
