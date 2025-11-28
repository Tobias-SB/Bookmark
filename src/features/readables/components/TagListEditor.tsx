// src/features/readables/components/TagListEditor.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

interface TagListEditorProps {
  label: string;
  tags: string[];
  onChangeTags: (tags: string[]) => void;
}

/**
 * Split a string on commas into a clean string[] list.
 */
const splitCommaList = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

/**
 * Generic editor for list fields: supports single-tag or comma-separated input.
 * Used for genres (books) and various AO3 fields (fanfic).
 */
const TagListEditor: React.FC<TagListEditorProps> = ({ label, tags, onChangeTags }) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const newTags = splitCommaList(input);
    if (newTags.length === 0) return;

    const merged = Array.from(new Set([...tags, ...newTags]));
    onChangeTags(merged);
    setInput('');
  };

  const handleRemove = (tag: string) => {
    onChangeTags(tags.filter((t) => t !== tag));
  };

  return (
    <View style={styles.tagEditor}>
      <Text style={styles.tagLabel}>{label}</Text>
      <View style={styles.tagInputRow}>
        <TextInput
          mode="outlined"
          style={styles.tagInput}
          value={input}
          onChangeText={setInput}
          placeholder="Add one or paste comma-separated"
        />
        <Button mode="text" onPress={handleAdd}>
          Add
        </Button>
      </View>
      <View style={styles.tagChipsRow}>
        {tags.map((tag) => (
          <Chip key={`${label}-${tag}`} style={styles.tagChip} onClose={() => handleRemove(tag)}>
            {tag}
          </Chip>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tagEditor: {
    marginTop: 12,
  },
  tagLabel: {
    marginBottom: 4,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    marginRight: 8,
  },
  tagChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  tagChip: {
    marginRight: 4,
    marginBottom: 4,
  },
});

export default TagListEditor;
