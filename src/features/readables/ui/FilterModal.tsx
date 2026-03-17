// src/features/readables/ui/FilterModal.tsx
// v2 Phase 6 — Full filter modal with all v2 filter sections.
// Feature-internal — not exported from readables/index.ts.
//
// Props:
//   visible        — controls modal visibility
//   filters        — current committed filters (used to seed draft on open)
//   onApply        — called with the draft when user taps Apply
//   onDismiss      — called when user taps × or taps outside (discards draft)
//   allReadables   — unfiltered full list used for live result count
//
// Internal draft state is seeded from props.filters each time visible goes true.
// Changes inside the modal do not propagate until Apply is pressed.
//
// Sections (in order):
//   1. Kind          — single-select chips (Books / Fanfic)
//   2. Status        — multi-select chips (4 statuses)
//   3. General       — "In a series" toggle chip
//   4. AO3 Filters   — rendered when Fanfic selected; message otherwise
//      - WIP / Complete toggle chips
//      - Abandoned only / Hide abandoned (mutually exclusive)
//      - Rating multi-select (5 values)
//      - Fandom autocomplete (vocabulary-only, one active value)
//   5. Tags          — rendered when kind has tagged readables
//      - Active tag chips with include/exclude toggle cycle
//      - Tag search input + vocabulary chips
//   6. Sort          — RadioButton.Group with kind-conditional options
//
// Footer (sticky): live count · Clear all · Apply

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Chip,
  Divider,
  IconButton,
  RadioButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../app/theme';
import type {
  AO3Rating,
  Readable,
  ReadableFilters,
  ReadableKind,
  ReadableStatus,
} from '../domain/readable';
import {
  AO3_RATING_LABELS,
  READABLE_STATUSES,
  STATUS_LABELS_FULL,
} from '../domain/readable';
import { applyFilters } from '../hooks/useReadables';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ReadableFilters = { sortBy: 'dateAdded', sortOrder: 'desc' };

const AO3_RATINGS: AO3Rating[] = ['general', 'teen', 'mature', 'explicit', 'not_rated'];

interface SortOption {
  label: string;
  sortBy: NonNullable<ReadableFilters['sortBy']>;
  sortOrder: NonNullable<ReadableFilters['sortOrder']>;
}

const SORT_OPTIONS_ALWAYS: SortOption[] = [
  { label: 'Date added (newest first)', sortBy: 'dateAdded', sortOrder: 'desc' },
  { label: 'Date added (oldest first)', sortBy: 'dateAdded', sortOrder: 'asc' },
  { label: 'Title A → Z', sortBy: 'title', sortOrder: 'asc' },
  { label: 'Title Z → A', sortBy: 'title', sortOrder: 'desc' },
  { label: 'Last updated (newest first)', sortBy: 'dateUpdated', sortOrder: 'desc' },
  { label: 'Last updated (oldest first)', sortBy: 'dateUpdated', sortOrder: 'asc' },
];

const SORT_OPTIONS_FANFIC: SortOption[] = [
  { label: 'Word count (longest first)', sortBy: 'wordCount', sortOrder: 'desc' },
  { label: 'Word count (shortest first)', sortBy: 'wordCount', sortOrder: 'asc' },
];

const SORT_OPTIONS_BOOK: SortOption[] = [
  { label: 'Page count (longest first)', sortBy: 'totalUnits', sortOrder: 'desc' },
  { label: 'Page count (shortest first)', sortBy: 'totalUnits', sortOrder: 'asc' },
];

function sortOptionKey(opt: SortOption): string {
  return `${opt.sortBy}-${opt.sortOrder}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clearAo3FilterValues(f: ReadableFilters): ReadableFilters {
  const { isComplete: _ic, isAbandoned: _ia, fandom: _fa, rating: _ra, ...rest } = f;
  return rest;
}

function kindSpecificSort(sortBy: ReadableFilters['sortBy']): boolean {
  return sortBy === 'wordCount' || sortBy === 'totalUnits';
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  filters: ReadableFilters;
  onApply: (filters: ReadableFilters) => void;
  onDismiss: () => void;
  allReadables: Readable[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FilterModal({ visible, filters, onApply, onDismiss, allReadables }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<ReadableFilters>(filters);
  const [fandomInput, setFandomInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Re-seed draft each time modal opens
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setFandomInput('');
      setTagInput('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Vocabulary — computed once when modal opens ────────────────────────────

  const fandomVocabulary = useMemo<string[]>(() => {
    if (!visible) return [];
    const fanficReadables = allReadables.filter((r) => r.kind === 'fanfic');
    const all = fanficReadables.flatMap((r) => r.fandom);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const tagVocabulary = useMemo<string[]>(() => {
    if (!visible) return [];
    const scoped = draft.kind
      ? allReadables.filter((r) => r.kind === draft.kind)
      : allReadables;
    const all = scoped.flatMap((r) => r.tags);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, draft.kind]);

  // ── Live result count ─────────────────────────────────────────────────────

  const liveCount = useMemo(
    () => applyFilters(allReadables, draft).length,
    [allReadables, draft],
  );

  // ── Draft mutation helpers ────────────────────────────────────────────────

  function setKind(kind: ReadableKind | undefined) {
    setDraft((prev) => {
      let next: ReadableFilters = { ...prev, kind };
      if (kind === 'book') next = clearAo3FilterValues(next);
      if (kindSpecificSort(next.sortBy)) {
        next = { ...next, sortBy: 'dateAdded', sortOrder: 'desc' };
      }
      return next;
    });
  }

  function toggleStatus(status: ReadableStatus) {
    setDraft((prev) => {
      const current = prev.status ?? [];
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status];
      return { ...prev, status: next.length > 0 ? next : undefined };
    });
  }

  function toggleIsComplete(value: boolean) {
    setDraft((prev) => ({
      ...prev,
      isComplete: prev.isComplete === value ? undefined : value,
    }));
  }

  function toggleIsAbandoned(value: boolean) {
    setDraft((prev) => ({
      ...prev,
      isAbandoned: prev.isAbandoned === value ? undefined : value,
    }));
  }

  function toggleRating(rating: AO3Rating) {
    setDraft((prev) => {
      const current = prev.rating ?? [];
      const next = current.includes(rating)
        ? current.filter((r) => r !== rating)
        : [...current, rating];
      return { ...prev, rating: next.length > 0 ? next : undefined };
    });
  }

  function selectFandom(value: string) {
    setDraft((prev) => ({ ...prev, fandom: value }));
    setFandomInput('');
  }

  function clearFandom() {
    setDraft((prev) => {
      const { fandom: _, ...rest } = prev;
      return rest;
    });
  }

  // Tag toggle cycle: include → exclude → deselected
  function cycleTag(tag: string) {
    setDraft((prev) => {
      const inInclude = prev.includeTags?.includes(tag) ?? false;
      const inExclude = prev.excludeTags?.includes(tag) ?? false;

      if (inInclude) {
        const includeTags = (prev.includeTags ?? []).filter((t) => t !== tag);
        const excludeTags = [...(prev.excludeTags ?? []), tag];
        return {
          ...prev,
          includeTags: includeTags.length > 0 ? includeTags : undefined,
          excludeTags,
        };
      } else if (inExclude) {
        const excludeTags = (prev.excludeTags ?? []).filter((t) => t !== tag);
        return {
          ...prev,
          excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
        };
      }
      return { ...prev, includeTags: [...(prev.includeTags ?? []), tag] };
    });
  }

  function removeTag(tag: string) {
    setDraft((prev) => {
      const includeTags = (prev.includeTags ?? []).filter((t) => t !== tag);
      const excludeTags = (prev.excludeTags ?? []).filter((t) => t !== tag);
      return {
        ...prev,
        includeTags: includeTags.length > 0 ? includeTags : undefined,
        excludeTags: excludeTags.length > 0 ? excludeTags : undefined,
      };
    });
  }

  function addIncludeTag(tag: string) {
    setDraft((prev) => ({
      ...prev,
      includeTags: [...(prev.includeTags ?? []), tag],
    }));
    setTagInput('');
  }

  function setSort(opt: SortOption) {
    setDraft((prev) => ({ ...prev, sortBy: opt.sortBy, sortOrder: opt.sortOrder }));
  }

  function handleClearAll() {
    setDraft(DEFAULT_FILTERS);
    setFandomInput('');
    setTagInput('');
  }

  function handleApply() {
    onApply(draft);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeTags = [
    ...(draft.includeTags ?? []).map((t) => ({ tag: t, mode: 'include' as const })),
    ...(draft.excludeTags ?? []).map((t) => ({ tag: t, mode: 'exclude' as const })),
  ];

  const activeTagSet = new Set([
    ...(draft.includeTags ?? []),
    ...(draft.excludeTags ?? []),
  ]);

  const filteredFandomVocab = fandomInput.trim()
    ? fandomVocabulary.filter((f) =>
        f.toLowerCase().includes(fandomInput.trim().toLowerCase()),
      )
    : fandomVocabulary;

  const filteredTagVocab = tagVocabulary.filter(
    (t) =>
      !activeTagSet.has(t) &&
      (tagInput.trim() === '' || t.toLowerCase().includes(tagInput.trim().toLowerCase())),
  );

  const hasTaggedReadables = tagVocabulary.length > 0;

  const currentSortKey = `${draft.sortBy ?? 'dateAdded'}-${draft.sortOrder ?? 'desc'}`;

  const sortOptions: SortOption[] = [
    ...SORT_OPTIONS_ALWAYS,
    ...(draft.kind === 'fanfic' ? SORT_OPTIONS_FANFIC : []),
    ...(draft.kind === 'book' ? SORT_OPTIONS_BOOK : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        onPress={onDismiss}
        accessibilityLabel="Close filter modal"
      >
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom },
          ]}
          onPress={() => undefined}
        >

          {/* ── Header ── */}
          <View
            style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}
          >
            <Text variant="titleMedium" style={{ color: theme.colors.textPrimary }}>
              Filters
            </Text>
            <IconButton
              icon="close"
              size={20}
              onPress={onDismiss}
              accessibilityLabel="Close filters"
            />
          </View>

          {/* ── Scrollable body ── */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Section: Kind ── */}
            <Text
              variant="labelLarge"
              style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
            >
              Kind
            </Text>
            <View style={styles.chipRow}>
              <Chip
                selected={draft.kind === 'book'}
                onPress={() => setKind(draft.kind === 'book' ? undefined : 'book')}
                style={styles.chip}
              >
                Books
              </Chip>
              <Chip
                selected={draft.kind === 'fanfic'}
                onPress={() => setKind(draft.kind === 'fanfic' ? undefined : 'fanfic')}
                style={styles.chip}
              >
                Fanfic
              </Chip>
            </View>

            <Divider style={styles.divider} />

            {/* ── Section: Status ── */}
            <Text
              variant="labelLarge"
              style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
            >
              Status
            </Text>
            <View style={styles.chipRow}>
              {READABLE_STATUSES.map((status) => (
                <Chip
                  key={status}
                  selected={draft.status?.includes(status) ?? false}
                  onPress={() => toggleStatus(status)}
                  style={styles.chip}
                >
                  {STATUS_LABELS_FULL[status]}
                </Chip>
              ))}
            </View>

            <Divider style={styles.divider} />

            {/* ── Section: General Filters ── */}
            <Text
              variant="labelLarge"
              style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
            >
              General
            </Text>
            <View style={styles.chipRow}>
              <Chip
                selected={draft.seriesOnly === true}
                onPress={() =>
                  setDraft((prev) => ({
                    ...prev,
                    seriesOnly: prev.seriesOnly === true ? undefined : true,
                  }))
                }
                style={styles.chip}
              >
                In a series
              </Chip>
            </View>

            <Divider style={styles.divider} />

            {/* ── Section: AO3 Filters ── */}
            <Text
              variant="labelLarge"
              style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
            >
              AO3 Filters
            </Text>

            {draft.kind === 'fanfic' ? (
              <>
                {/* WIP / Complete */}
                <View style={styles.chipRow}>
                  <Chip
                    selected={draft.isComplete === false}
                    onPress={() => toggleIsComplete(false)}
                    style={styles.chip}
                  >
                    WIP
                  </Chip>
                  <Chip
                    selected={draft.isComplete === true}
                    onPress={() => toggleIsComplete(true)}
                    style={styles.chip}
                  >
                    Complete
                  </Chip>
                </View>

                {/* Abandoned */}
                <Text
                  variant="labelSmall"
                  style={[styles.subLabel, { color: theme.colors.textSecondary }]}
                >
                  Abandoned
                </Text>
                <View style={styles.chipRow}>
                  <Chip
                    selected={draft.isAbandoned === true}
                    onPress={() => toggleIsAbandoned(true)}
                    style={styles.chip}
                  >
                    Abandoned only
                  </Chip>
                  <Chip
                    selected={draft.isAbandoned === false}
                    onPress={() => toggleIsAbandoned(false)}
                    style={styles.chip}
                  >
                    Hide abandoned
                  </Chip>
                </View>

                {/* Rating */}
                <Text
                  variant="labelSmall"
                  style={[styles.subLabel, { color: theme.colors.textSecondary }]}
                >
                  Rating
                </Text>
                <View style={styles.chipRow}>
                  {AO3_RATINGS.map((rating) => (
                    <Chip
                      key={rating}
                      selected={draft.rating?.includes(rating) ?? false}
                      onPress={() => toggleRating(rating)}
                      style={styles.chip}
                    >
                      {AO3_RATING_LABELS[rating]}
                    </Chip>
                  ))}
                </View>

                {/* Fandom */}
                <Text
                  variant="labelSmall"
                  style={[styles.subLabel, { color: theme.colors.textSecondary }]}
                >
                  Fandom
                </Text>
                {draft.fandom !== undefined ? (
                  <Chip
                    onClose={clearFandom}
                    style={styles.chip}
                    selected
                    accessibilityLabel={`Active fandom filter: ${draft.fandom}`}
                  >
                    {draft.fandom}
                  </Chip>
                ) : (
                  <>
                    <TextInput
                      mode="outlined"
                      placeholder="Search fandoms…"
                      value={fandomInput}
                      onChangeText={setFandomInput}
                      dense
                      style={styles.textInput}
                      accessibilityLabel="Search fandom vocabulary"
                    />
                    {filteredFandomVocab.length > 0 && (
                      <View style={styles.chipRow}>
                        {filteredFandomVocab.slice(0, 20).map((f) => (
                          <Chip
                            key={f}
                            onPress={() => selectFandom(f)}
                            style={styles.chip}
                          >
                            {f}
                          </Chip>
                        ))}
                      </View>
                    )}
                    {filteredFandomVocab.length === 0 && fandomInput.trim() !== '' && (
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        No matching fandoms in library
                      </Text>
                    )}
                    {fandomVocabulary.length === 0 && (
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        No fandoms in library yet
                      </Text>
                    )}
                  </>
                )}
              </>
            ) : draft.kind === 'book' ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.textSecondary }}
              >
                AO3 filters are not available for books.
              </Text>
            ) : (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.textSecondary }}
              >
                Select Fanfic to filter by AO3 fields.
              </Text>
            )}

            <Divider style={styles.divider} />

            {/* ── Section: Tags ── */}
            {hasTaggedReadables && (
              <>
                <Text
                  variant="labelLarge"
                  style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
                >
                  Tags
                </Text>

                {/* Active tag chips with toggle cycle */}
                {activeTags.length > 0 && (
                  <View style={styles.chipRow}>
                    {activeTags.map(({ tag, mode }) => (
                      <Chip
                        key={`${mode}-${tag}`}
                        onPress={() => cycleTag(tag)}
                        onClose={() => removeTag(tag)}
                        style={[
                          styles.chip,
                          mode === 'include'
                            ? { backgroundColor: theme.colors.primaryContainer }
                            : { backgroundColor: theme.colors.errorContainer },
                        ]}
                        accessibilityLabel={`${mode === 'include' ? 'Include' : 'Exclude'} tag: ${tag}. Tap to cycle.`}
                      >
                        {mode === 'exclude' ? `not ${tag}` : tag}
                      </Chip>
                    ))}
                  </View>
                )}

                {/* Tag search input */}
                <TextInput
                  mode="outlined"
                  placeholder="Search tags…"
                  value={tagInput}
                  onChangeText={setTagInput}
                  dense
                  style={styles.textInput}
                  accessibilityLabel="Search tag vocabulary"
                />

                {/* Tag vocabulary chips */}
                {filteredTagVocab.length > 0 && (
                  <View style={styles.chipRow}>
                    {filteredTagVocab.slice(0, 30).map((tag) => (
                      <Chip
                        key={tag}
                        onPress={() => addIncludeTag(tag)}
                        style={styles.chip}
                      >
                        {tag}
                      </Chip>
                    ))}
                  </View>
                )}

                <Divider style={styles.divider} />
              </>
            )}

            {/* ── Section: Sort ── */}
            <Text
              variant="labelLarge"
              style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
            >
              Sort
            </Text>
            <RadioButton.Group
              value={currentSortKey}
              onValueChange={(key) => {
                const opt = sortOptions.find((o) => sortOptionKey(o) === key);
                if (opt) setSort(opt);
              }}
            >
              {sortOptions.map((opt) => {
                const key = sortOptionKey(opt);
                return (
                  <Pressable
                    key={key}
                    style={styles.radioRow}
                    onPress={() => setSort(opt)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: currentSortKey === key }}
                  >
                    <RadioButton value={key} />
                    <Text
                      variant="bodyMedium"
                      style={[styles.radioLabel, { color: theme.colors.textPrimary }]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </RadioButton.Group>

          </ScrollView>

          {/* ── Footer ── */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text
              variant="bodySmall"
              style={[styles.liveCount, { color: theme.colors.textSecondary }]}
            >
              {liveCount === 1 ? '1 readable matches' : `${liveCount} readables match`}
            </Text>
            <View style={styles.footerActions}>
              <Button onPress={handleClearAll} accessibilityLabel="Clear all filters">
                Clear all
              </Button>
              <Button
                mode="contained"
                onPress={handleApply}
                accessibilityLabel="Apply filters"
              >
                Apply
              </Button>
            </View>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 4,
  },
  subLabel: {
    marginTop: 8,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    // Paper chip handles sizing
  },
  textInput: {
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  radioLabel: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  liveCount: {
    textAlign: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
