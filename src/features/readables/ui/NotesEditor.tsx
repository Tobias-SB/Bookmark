// src/features/readables/ui/NotesEditor.tsx
// v2 Phase 5 — Feature-internal modal for viewing and editing private notes.
// Not exported from readables/index.ts — used only by ReadableDetailScreen.
//
// Pattern mirrors ProgressEditor (Phase 9 v1):
//   - Modal with full-height multiline TextInput
//   - Cancel: if unsaved changes, Alert.alert to confirm discard
//   - Save: calls onSave(text.trim() || null); modal stays open on failure (caller controls visible)
//   - KeyboardAvoidingView with platform-appropriate behavior
//
// Props:
//   visible          — controls modal visibility
//   initialNotes     — string | null — pre-populated value when modal opens
//   onDismiss        — called when user cancels (after discard confirmation if needed)
//   isSaving         — true during save mutation
//   onSave           — called with (notes: string | null) on save

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Dialog,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import { useAppTheme } from '../../../app/theme';

interface Props {
  visible: boolean;
  initialNotes: string | null;
  onDismiss: () => void;
  isSaving: boolean;
  onSave: (notes: string | null) => void;
}

export function NotesEditor({ visible, initialNotes, onDismiss, isSaving, onSave }: Props) {
  const theme = useAppTheme();
  const [text, setText] = useState(initialNotes ?? '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);


  // Reset internal state each time the modal opens with fresh initialNotes.
  useEffect(() => {
    if (visible) {
      setText(initialNotes ?? '');
      setHasUnsavedChanges(false);
    }
  }, [visible, initialNotes]);

  function handleChangeText(value: string) {
    setText(value);
    if (!hasUnsavedChanges) setHasUnsavedChanges(true);
  }

  function handleCancel() {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard changes?',
        'Your changes to the notes will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: onDismiss,
          },
        ],
      );
    } else {
      onDismiss();
    }
  }

  function handleSave() {
    onSave(text.trim() || null);
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={handleCancel}
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Dialog.Title style={{ color: theme.colors.textPrimary }}>Notes</Dialog.Title>
        <Dialog.Content>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={8}
              value={text}
              onChangeText={handleChangeText}
              placeholder="Private notes — not imported from AO3"
              accessibilityLabel="Notes text editor"
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
              autoFocus
            />
          </KeyboardAvoidingView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            accessibilityLabel="Save notes"
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 160,
  },
});
