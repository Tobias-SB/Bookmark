// src/features/readables/components/SmartShelvesBar.tsx
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import type { SmartShelf, SmartShelfId } from '@src/features/readables/types/smartShelves';
import type { LibraryFilterState } from '@src/features/readables/types/libraryFilters';
import {
  useCreateSmartShelf,
  useUpdateSmartShelf,
  useDeleteSmartShelf,
} from '@src/features/readables/hooks/useSmartShelves';

interface SmartShelvesBarProps {
  shelves: SmartShelf[];
  selectedShelfId: 'all' | SmartShelfId;
  onSelectAll: () => void;
  onSelectShelf: (shelf: SmartShelf) => void;
  /**
   * The current LibraryFilterState, used when saving a new shelf.
   */
  currentFilter: LibraryFilterState;
}

/**
 * Horizontal chip row for Smart Shelves.
 *
 * - Always shows an implicit "All" shelf.
 * - Then one chip per user-defined Smart Shelf.
 * - Tapping a shelf selects it.
 * - Long-press a shelf to rename/delete.
 * - "Save shelf" captures the current filters as a new Smart Shelf.
 */
const SmartShelvesBar: React.FC<SmartShelvesBarProps> = ({
  shelves,
  selectedShelfId,
  onSelectAll,
  onSelectShelf,
  currentFilter,
}) => {
  const theme = useTheme();

  const createShelfMutation = useCreateSmartShelf();
  const updateShelfMutation = useUpdateSmartShelf();
  const deleteShelfMutation = useDeleteSmartShelf();

  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');

  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingShelf, setEditingShelf] = useState<SmartShelf | null>(null);
  const [editShelfName, setEditShelfName] = useState('');

  const hasUserShelves = shelves.length > 0;

  const handleOpenSaveDialog = () => {
    setNewShelfName('');
    setSaveDialogVisible(true);
  };

  const handleCloseSaveDialog = () => {
    setSaveDialogVisible(false);
  };

  const handleConfirmSaveShelf = async () => {
    try {
      const shelf = await createShelfMutation.mutateAsync({
        name: newShelfName,
        filter: currentFilter,
      });
      // Immediately select the new shelf in the parent.
      onSelectShelf(shelf);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to create smart shelf', e);
    } finally {
      setSaveDialogVisible(false);
    }
  };

  const handleOpenEditDialog = (shelf: SmartShelf) => {
    setEditingShelf(shelf);
    setEditShelfName(shelf.name);
    setEditDialogVisible(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogVisible(false);
    setEditingShelf(null);
  };

  const handleConfirmRenameShelf = async () => {
    if (!editingShelf) return;

    try {
      await updateShelfMutation.mutateAsync({
        id: editingShelf.id,
        name: editShelfName,
      });
      // React Query invalidation refreshes the shelves list; selection stays as-is.
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to rename smart shelf', e);
    } finally {
      handleCloseEditDialog();
    }
  };

  const handleConfirmDeleteShelf = async () => {
    if (!editingShelf) return;

    try {
      await deleteShelfMutation.mutateAsync(editingShelf.id);
      // After deletion, fall back to the "All" shelf.
      onSelectAll();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete smart shelf', e);
    } finally {
      handleCloseEditDialog();
    }
  };

  const handleDeleteShelfWithConfirm = () => {
    if (!editingShelf) return;

    Alert.alert(
      'Delete shelf',
      `Are you sure you want to delete the shelf "${editingShelf.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleConfirmDeleteShelf,
        },
      ],
    );
  };

  // React Query v5 → `isPending` instead of `isLoading`
  const isMutating =
    createShelfMutation.isPending || updateShelfMutation.isPending || deleteShelfMutation.isPending;

  return (
    <View style={styles.container}>
      <Text variant="titleSmall" style={styles.label}>
        Shelves
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip
          key="all-shelf"
          style={styles.chip}
          selected={selectedShelfId === 'all'}
          onPress={onSelectAll}
        >
          All
        </Chip>

        {hasUserShelves &&
          shelves.map((shelf) => (
            <Chip
              key={shelf.id}
              style={styles.chip}
              selected={selectedShelfId === shelf.id}
              onPress={() => onSelectShelf(shelf)}
              onLongPress={() => handleOpenEditDialog(shelf)}
            >
              {shelf.name}
            </Chip>
          ))}

        <Button
          mode="text"
          compact
          onPress={handleOpenSaveDialog}
          disabled={isMutating}
          style={styles.saveButton}
        >
          Save shelf
        </Button>
      </ScrollView>

      <Text
        variant="labelSmall"
        style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}
      >
        Save the current filters as a shelf. Long-press a shelf to rename or delete it.
      </Text>

      <Portal>
        {/* Save shelf dialog */}
        <Dialog visible={saveDialogVisible} onDismiss={handleCloseSaveDialog}>
          <Dialog.Title>Save current filters as shelf</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Shelf name"
              value={newShelfName}
              onChangeText={setNewShelfName}
              placeholder="e.g. Cozy WIP found family"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCloseSaveDialog}>Cancel</Button>
            <Button onPress={handleConfirmSaveShelf} loading={createShelfMutation.isPending}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Edit / rename shelf dialog */}
        <Dialog visible={editDialogVisible} onDismiss={handleCloseEditDialog}>
          <Dialog.Title>Edit shelf</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Shelf name"
              value={editShelfName}
              onChangeText={setEditShelfName}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCloseEditDialog}>Cancel</Button>
            <Button onPress={handleConfirmRenameShelf} loading={updateShelfMutation.isPending}>
              Rename
            </Button>
            <Button
              onPress={handleDeleteShelfWithConfirm}
              loading={deleteShelfMutation.isPending}
              textColor={theme.colors.error}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  label: {
    marginBottom: 4,
    opacity: 0.8,
  },
  chipsRow: {
    paddingBottom: 4,
    alignItems: 'center',
  },
  chip: {
    marginRight: 8,
  },
  saveButton: {
    marginLeft: 4,
  },
  helperText: {
    marginTop: 2,
    fontSize: 11,
  },
});

export default SmartShelvesBar;
