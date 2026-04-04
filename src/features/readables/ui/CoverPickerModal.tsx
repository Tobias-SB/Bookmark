// src/features/readables/ui/CoverPickerModal.tsx
// §3.5 — Cover image picker modal for ReadableDetailScreen.
// Feature-internal — not exported from readables/index.ts.
// Same pattern as NotesEditor and ProgressEditor.
//
// Three action rows:
//   1. Choose from device (expo-image-picker, requires permission)
//   2. Paste image URL (TextInput + submit)
//   3. Remove cover (only shown when hasCover = true)

import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Divider,
  Portal,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '../../../app/theme';
import { useUpdateCover } from '../hooks/useUpdateCover';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDismiss: () => void;
  readableId: string;
  /** Whether the readable currently has a cover (controls "Remove cover" row). */
  hasCover: boolean;
  /** Called with an error message when a cover operation fails. */
  onError: (message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoverPickerModal({ visible, onDismiss, readableId, hasCover, onError }: Props) {
  const theme = useAppTheme();
  const { updateCoverAsync, isPending } = useUpdateCover();

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  function handleDismiss() {
    setUrlInput('');
    setShowUrlInput(false);
    onDismiss();
  }

  async function handlePickFromDevice() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      onError('Photo library access is required to choose a cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    try {
      await updateCoverAsync({ readableId, mode: 'local', uri: result.assets[0].uri });
      handleDismiss();
    } catch (err: unknown) {
      onError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save cover.',
      );
    }
  }

  async function handlePasteUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      await updateCoverAsync({ readableId, mode: 'url', uri: trimmed });
      handleDismiss();
    } catch (err: unknown) {
      onError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to download cover.',
      );
    }
  }

  async function handleRemove() {
    try {
      await updateCoverAsync({ readableId, mode: 'remove' });
      handleDismiss();
    } catch (err: unknown) {
      onError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to remove cover.',
      );
    }
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={handleDismiss}
        style={{ backgroundColor: theme.colors.backgroundCard }}
      >
        <Dialog.Title style={{ color: theme.colors.textPrimary }}>Set cover</Dialog.Title>

        <Dialog.Content style={styles.content}>
          {isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" />
              <Text style={[styles.loadingText, { color: theme.colors.textMeta }]}>Saving…</Text>
            </View>
          ) : (
            <>
              {/* Choose from device */}
              <TouchableRipple
                onPress={handlePickFromDevice}
                accessibilityRole="button"
                accessibilityLabel="Choose from device"
              >
                <Text style={[styles.actionRow, { color: theme.colors.textPrimary }]}>
                  Choose from device
                </Text>
              </TouchableRipple>

              <Divider />

              {/* Paste image URL */}
              {showUrlInput ? (
                <View style={styles.urlInputRow}>
                  <TextInput
                    style={[
                      styles.urlInput,
                      {
                        color: theme.colors.textPrimary,
                        backgroundColor: theme.colors.backgroundInput,
                        borderColor: theme.colors.outline,
                      },
                    ]}
                    placeholder="https://…"
                    placeholderTextColor={theme.colors.textMeta}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="done"
                    onSubmitEditing={handlePasteUrl}
                    autoFocus
                  />
                  <Button
                    mode="contained"
                    onPress={handlePasteUrl}
                    disabled={urlInput.trim() === ''}
                    compact
                    style={styles.urlSubmitButton}
                  >
                    Use
                  </Button>
                </View>
              ) : (
                <TouchableRipple
                  onPress={() => setShowUrlInput(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Paste image URL"
                >
                  <Text style={[styles.actionRow, { color: theme.colors.textPrimary }]}>
                    Paste image URL
                  </Text>
                </TouchableRipple>
              )}

              {/* Remove cover — only when a cover exists */}
              {hasCover && (
                <>
                  <Divider />
                  <TouchableRipple
                    onPress={handleRemove}
                    accessibilityRole="button"
                    accessibilityLabel="Remove cover"
                  >
                    <Text style={[styles.actionRow, { color: theme.colors.danger }]}>
                      Remove cover
                    </Text>
                  </TouchableRipple>
                </>
              )}
            </>
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={handleDismiss} disabled={isPending}>
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  actionRow: {
    fontSize: 15,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  urlSubmitButton: {
    flexShrink: 0,
  },
});
