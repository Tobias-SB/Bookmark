// src/features/shelves/ui/ShelvesSection.tsx
// Renders all shelves above the main readable list in LibraryScreen.
//
// Create-shelf flow opens a full modal with:
//   - Shelf name field (required)
//   - Optional kind filter (Books / Fanfic toggle chips)
//   - Optional status filter (multi-select chips)
//   - Optional fandom filter (chips derived from fandoms present in the library)
// On confirm the shelf is created and any matching readables are bulk-added
// (one addToShelf call per match). The shelf remains static after creation.
//
// Rename/delete flow uses Alert options on long-press.

import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { useAppTheme } from '../../../app/theme';
import type { Readable, ReadableKind, ReadableStatus } from '../../readables/domain/readable';
import {
  KIND_LABELS,
  READABLE_STATUSES,
  STATUS_LABELS_SHORT,
} from '../../readables/domain/readable';
import { AppModal, AppModalButton } from '../../../shared/components/AppModal';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useShelves } from '../hooks/useShelves';
import { useShelfReadables } from '../hooks/useShelfReadables';
import { useCreateShelf } from '../hooks/useCreateShelf';
import { useUpdateShelf } from '../hooks/useUpdateShelf';
import { useDeleteShelf } from '../hooks/useDeleteShelf';
import { useAddToShelf } from '../hooks/useAddToShelf';
import type { Shelf } from '../domain/shelf';
import { ShelfCard } from './ShelfCard';

// ── Per-shelf readables resolver ──────────────────────────────────────────────

interface ShelfCardContainerProps {
  shelf: Shelf;
  allReadables: Readable[];
  onEdit: (shelf: Shelf) => void;
}

function ShelfCardContainer({ shelf, allReadables, onEdit }: ShelfCardContainerProps) {
  const { items } = useShelfReadables(shelf.id);
  const readableIds = useMemo(() => new Set(items.map((i) => i.readableId)), [items]);
  const shelfReadables = useMemo(
    () => allReadables.filter((r) => readableIds.has(r.id)),
    [allReadables, readableIds],
  );
  return (
    <ShelfCard
      shelf={shelf}
      readables={shelfReadables}
      onEdit={() => onEdit(shelf)}
    />
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color: string;
  subtleColor: string;
  borderColor: string;
}

function Chip({ label, selected, onPress, color, subtleColor, borderColor }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        chipStyles.chip,
        selected
          ? { backgroundColor: subtleColor, borderColor }
          : { backgroundColor: 'transparent', borderColor },
      ]}
    >
      <Text style={[chipStyles.label, { color: selected ? color : color, opacity: selected ? 1 : 0.6 }]}>
        {selected ? '✓ ' : ''}{label}
      </Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  allReadables: Readable[];
}

export function ShelvesSection({ allReadables }: Props) {
  const theme = useAppTheme();
  const { shelves, isLoading } = useShelves();
  const { create, isPending: isCreating } = useCreateShelf();
  const { update, isPending: isRenaming } = useUpdateShelf();
  const { remove, isPending: isDeleting } = useDeleteShelf();
  const { addAsync: addToShelf } = useAddToShelf();

  // ── Create modal state ────────────────────────────────────────────────────
  const [createVisible, setCreateVisible] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [selectedKind, setSelectedKind] = useState<ReadableKind | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<ReadableStatus[]>([]);
  const [selectedFandoms, setSelectedFandoms] = useState<string[]>([]);

  // ── Delete / rename state ─────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Shelf | null>(null);
  const [renameTarget, setRenameTarget] = useState<Shelf | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameVisible, setRenameVisible] = useState(false);

  // ── Derived: unique fandoms present in the library ────────────────────────
  const availableFandoms = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allReadables) {
      for (const f of r.fandom ?? []) {
        if (f.trim()) seen.add(f.trim());
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [allReadables]);

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={theme.colors.kindBook} />
      </View>
    );
  }

  if (shelves.length === 0) return null;

  // ── Create helpers ─────────────────────────────────────────────────────────

  function openCreateModal() {
    setNewShelfName('');
    setSelectedKind(null);
    setSelectedStatuses([]);
    setSelectedFandoms([]);
    setCreateVisible(true);
  }

  /** Returns readables that match all active auto-fill filters. */
  function matchingReadables(): Readable[] {
    const hasFilters =
      selectedKind !== null ||
      selectedStatuses.length > 0 ||
      selectedFandoms.length > 0;
    if (!hasFilters) return [];

    return allReadables.filter((r) => {
      if (selectedKind !== null && r.kind !== selectedKind) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status)) return false;
      if (selectedFandoms.length > 0) {
        const rFandoms = r.fandom ?? [];
        if (!selectedFandoms.some((f) => rFandoms.includes(f))) return false;
      }
      return true;
    });
  }

  function toggleStatus(s: ReadableStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function toggleFandom(f: string) {
    setSelectedFandoms((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  async function handleConfirmCreate() {
    if (!newShelfName.trim()) return;
    const toAdd = matchingReadables();
    create(
      { name: newShelfName.trim() },
      {
        onSuccess: async (newShelf) => {
          setCreateVisible(false);
          // Bulk-add matching readables sequentially
          for (const r of toAdd) {
            await addToShelf({ shelfId: newShelf.id, readableId: r.id });
          }
        },
      },
    );
  }

  // ── Rename / delete helpers ────────────────────────────────────────────────

  function handleEditShelf(shelf: Shelf) {
    Alert.alert(shelf.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setRenameValue(shelf.name);
          setRenameTarget(shelf);
          setRenameVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setDeleteTarget(shelf),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleConfirmRename() {
    if (renameTarget && renameValue.trim()) {
      update(
        { id: renameTarget.id, input: { name: renameValue.trim() } },
        {
          onSuccess: () => {
            setRenameVisible(false);
            setRenameTarget(null);
          },
        },
      );
    }
  }

  function handleConfirmDelete() {
    if (deleteTarget) {
      remove(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
    }
  }

  // ── Preview count ──────────────────────────────────────────────────────────
  const previewCount = matchingReadables().length;
  const hasAutoFill = selectedKind !== null || selectedStatuses.length > 0 || selectedFandoms.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.colors.kindFanfic }]}>
          MY SHELVES
        </Text>
        <TouchableOpacity
          onPress={openCreateModal}
          accessibilityRole="button"
          accessibilityLabel="Add new shelf"
          style={styles.addButtonTouch}
        >
          <Text style={[styles.addButton, { color: theme.colors.kindBook }]}>+ New</Text>
        </TouchableOpacity>
      </View>

      {shelves.map((shelf) => (
        <ShelfCardContainer
          key={shelf.id}
          shelf={shelf}
          allReadables={allReadables}
          onEdit={handleEditShelf}
        />
      ))}

      {/* ── Create shelf modal ─────────────────────────────────────────────── */}
      <AppModal
        visible={createVisible}
        onDismiss={() => setCreateVisible(false)}
        title="New Shelf"
      >
        <ScrollView
          style={styles.createScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <Text style={[styles.fieldLabel, { color: theme.colors.textMeta }]}>NAME</Text>
          <TextInput
            value={newShelfName}
            onChangeText={setNewShelfName}
            placeholder="e.g. Comfort reads"
            placeholderTextColor={theme.colors.textHint}
            autoFocus
            style={[
              styles.textInput,
              {
                color: theme.colors.textBody,
                borderColor: theme.colors.backgroundBorder,
                backgroundColor: theme.colors.backgroundInput,
              },
            ]}
          />

          {/* Auto-fill section */}
          <Text style={[styles.fieldLabel, { color: theme.colors.textMeta, marginTop: 16 }]}>
            AUTO-FILL FROM  <Text style={[styles.fieldHint, { color: theme.colors.textHint }]}>(optional)</Text>
          </Text>
          <Text style={[styles.fieldHint, { color: theme.colors.textMeta, marginBottom: 8 }]}>
            Select filters to auto-populate the shelf on creation.
          </Text>

          {/* Kind */}
          <Text style={[styles.filterGroupLabel, { color: theme.colors.textMeta }]}>Kind</Text>
          <View style={styles.chipRow}>
            {(['book', 'fanfic'] as ReadableKind[]).map((k) => (
              <Chip
                key={k}
                label={KIND_LABELS[k]}
                selected={selectedKind === k}
                onPress={() => setSelectedKind(selectedKind === k ? null : k)}
                color={k === 'book' ? theme.colors.kindBook : theme.colors.kindFanfic}
                subtleColor={k === 'book' ? theme.colors.kindBookSubtle : theme.colors.kindFanficSubtle}
                borderColor={k === 'book' ? theme.colors.kindBookBorder : theme.colors.kindFanficBorder}
              />
            ))}
          </View>

          {/* Status */}
          <Text style={[styles.filterGroupLabel, { color: theme.colors.textMeta }]}>Status</Text>
          <View style={styles.chipRow}>
            {READABLE_STATUSES.map((s) => (
              <Chip
                key={s}
                label={STATUS_LABELS_SHORT[s]}
                selected={selectedStatuses.includes(s)}
                onPress={() => toggleStatus(s)}
                color={theme.colors.kindBook}
                subtleColor={theme.colors.kindBookSubtle}
                borderColor={theme.colors.kindBookBorder}
              />
            ))}
          </View>

          {/* Fandom — only shown when fanfic readables exist */}
          {availableFandoms.length > 0 && (
            <>
              <Text style={[styles.filterGroupLabel, { color: theme.colors.textMeta }]}>Fandom</Text>
              <View style={styles.chipRow}>
                {availableFandoms.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    selected={selectedFandoms.includes(f)}
                    onPress={() => toggleFandom(f)}
                    color={theme.colors.kindFanfic}
                    subtleColor={theme.colors.kindFanficSubtle}
                    borderColor={theme.colors.kindFanficBorder}
                  />
                ))}
              </View>
            </>
          )}

          {/* Preview count */}
          {hasAutoFill && (
            <Text style={[styles.previewText, { color: theme.colors.textMeta }]}>
              {previewCount === 0
                ? 'No matches in your library'
                : `${previewCount} readable${previewCount === 1 ? '' : 's'} will be added`}
            </Text>
          )}
        </ScrollView>

        <AppModal.Actions>
          <AppModalButton label="Cancel" onPress={() => setCreateVisible(false)} />
          <AppModalButton
            label="Create"
            variant="primary"
            loading={isCreating}
            onPress={() => { void handleConfirmCreate(); }}
            disabled={!newShelfName.trim()}
          />
        </AppModal.Actions>
      </AppModal>

      {/* ── Rename shelf modal ─────────────────────────────────────────────── */}
      <AppModal
        visible={renameVisible}
        onDismiss={() => setRenameVisible(false)}
        title="Rename Shelf"
      >
        <TextInput
          value={renameValue}
          onChangeText={setRenameValue}
          placeholder="Shelf name"
          placeholderTextColor={theme.colors.textHint}
          autoFocus
          onSubmitEditing={handleConfirmRename}
          style={[
            styles.textInput,
            {
              color: theme.colors.textBody,
              borderColor: theme.colors.backgroundBorder,
              backgroundColor: theme.colors.backgroundInput,
              marginBottom: 8,
            },
          ]}
        />
        <AppModal.Actions>
          <AppModalButton label="Cancel" onPress={() => setRenameVisible(false)} />
          <AppModalButton
            label="Rename"
            variant="primary"
            loading={isRenaming}
            onPress={handleConfirmRename}
            disabled={!renameValue.trim()}
          />
        </AppModal.Actions>
      </AppModal>

      {/* ── Delete confirm dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Shelf?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed. Your readables will not be affected.`
            : ''
        }
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  loadingRow: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addButtonTouch: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 12,
  },
  addButton: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Create modal
  createScroll: {
    maxHeight: 440,
    paddingHorizontal: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 14,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 4,
  },
});
