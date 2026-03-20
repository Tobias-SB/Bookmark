// src/features/readables/ui/FilterModal.tsx
// UI Phase 5 — Full filter modal redesign.
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
//   6. Sort          — custom radio rows with kind-conditional options
//
// Footer (sticky): live count · Clear all · Apply

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../../app/theme';
import type { AppTheme } from '../../../app/theme/tokens';
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

interface ChipColors {
  bg: string;
  border: string;
  text: string;
}

function getActiveChipColors(theme: AppTheme, variant: 'book' | 'fanfic' | 'include' | 'exclude' | 'neutral'): ChipColors {
  switch (variant) {
    case 'fanfic':
      return { bg: theme.colors.kindFanficSubtle, border: theme.colors.kindFanficBorder, text: theme.colors.kindFanfic };
    case 'exclude':
      return { bg: theme.colors.dangerSubtle, border: theme.colors.dangerBorder, text: theme.colors.danger };
    case 'include':
    case 'book':
    case 'neutral':
    default:
      return { bg: theme.colors.kindBookSubtle, border: theme.colors.kindBookBorder, text: theme.colors.kindBook };
  }
}

function getInactiveChipColors(theme: AppTheme): ChipColors {
  return { bg: theme.colors.backgroundInput, border: theme.colors.backgroundBorder, text: theme.colors.textBody };
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

  // ── Local chip renderer ───────────────────────────────────────────────────

  function renderChip(opts: {
    label: string;
    active: boolean;
    onPress: () => void;
    activeVariant?: 'book' | 'fanfic' | 'include' | 'exclude' | 'neutral';
    onRemove?: () => void;
    accessibilityLabel?: string;
  }) {
    const { label, active, onPress, activeVariant = 'neutral', onRemove, accessibilityLabel } = opts;
    const colors = active
      ? getActiveChipColors(theme, activeVariant)
      : getInactiveChipColors(theme);

    return (
      <TouchableOpacity
        key={label}
        onPress={onPress}
        style={[
          chipStyles.chip,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
        ]}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[chipStyles.chipText, { color: colors.text }]}>{label}</Text>
        {onRemove && (
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityLabel={`Remove ${label}`}
          >
            <Text style={[chipStyles.chipRemove, { color: colors.text }]}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

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
        style={styles.overlay}
        onPress={onDismiss}
        accessibilityLabel="Close filter modal"
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundPage,
              paddingBottom: insets.bottom,
            },
          ]}
          onPress={() => undefined}
        >

          {/* ── Header ── */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.colors.backgroundInput,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              },
            ]}
          >
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
              Filters
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.closeButton, { backgroundColor: theme.colors.backgroundBorder }]}
              accessibilityLabel="Close filters"
              accessibilityRole="button"
            >
              <Text style={[styles.closeButtonText, { color: theme.colors.textBody }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Scrollable body ── */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Section: Kind ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>KIND</Text>
            <View style={styles.chipRow}>
              {renderChip({
                label: 'Books',
                active: draft.kind === 'book',
                activeVariant: 'book',
                onPress: () => setKind(draft.kind === 'book' ? undefined : 'book'),
              })}
              {renderChip({
                label: 'Fanfic',
                active: draft.kind === 'fanfic',
                activeVariant: 'fanfic',
                onPress: () => setKind(draft.kind === 'fanfic' ? undefined : 'fanfic'),
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />

            {/* ── Section: Status ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>STATUS</Text>
            <View style={styles.chipRow}>
              {READABLE_STATUSES.map((status) =>
                renderChip({
                  label: STATUS_LABELS_FULL[status],
                  active: draft.status?.includes(status) ?? false,
                  onPress: () => toggleStatus(status),
                })
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />

            {/* ── Section: General Filters ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>GENERAL</Text>
            <View style={styles.chipRow}>
              {renderChip({
                label: 'In a series',
                active: draft.seriesOnly === true,
                onPress: () =>
                  setDraft((prev) => ({
                    ...prev,
                    seriesOnly: prev.seriesOnly === true ? undefined : true,
                  })),
              })}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />

            {/* ── Section: AO3 Filters ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>AO3 FILTERS</Text>

            {draft.kind === 'fanfic' ? (
              <>
                {/* WIP / Complete */}
                <View style={styles.chipRow}>
                  {renderChip({
                    label: 'WIP',
                    active: draft.isComplete === false,
                    onPress: () => toggleIsComplete(false),
                  })}
                  {renderChip({
                    label: 'Complete',
                    active: draft.isComplete === true,
                    onPress: () => toggleIsComplete(true),
                  })}
                </View>

                {/* Abandoned */}
                <Text style={[styles.subLabel, { color: theme.colors.textMeta }]}>Abandoned</Text>
                <View style={styles.chipRow}>
                  {renderChip({
                    label: 'Abandoned only',
                    active: draft.isAbandoned === true,
                    onPress: () => toggleIsAbandoned(true),
                  })}
                  {renderChip({
                    label: 'Hide abandoned',
                    active: draft.isAbandoned === false,
                    onPress: () => toggleIsAbandoned(false),
                  })}
                </View>

                {/* Rating */}
                <Text style={[styles.subLabel, { color: theme.colors.textMeta }]}>Rating</Text>
                <View style={styles.chipRow}>
                  {AO3_RATINGS.map((rating) =>
                    renderChip({
                      label: AO3_RATING_LABELS[rating],
                      active: draft.rating?.includes(rating) ?? false,
                      onPress: () => toggleRating(rating),
                    })
                  )}
                </View>

                {/* Fandom */}
                <Text style={[styles.subLabel, { color: theme.colors.textMeta }]}>Fandom</Text>
                {draft.fandom !== undefined ? (
                  <View style={styles.chipRow}>
                    {renderChip({
                      label: draft.fandom,
                      active: true,
                      activeVariant: 'fanfic',
                      onPress: () => undefined,
                      onRemove: clearFandom,
                      accessibilityLabel: `Active fandom filter: ${draft.fandom}`,
                    })}
                  </View>
                ) : (
                  <>
                    <TextInput
                      placeholder="Search fandoms…"
                      value={fandomInput}
                      onChangeText={setFandomInput}
                      style={[
                        styles.searchInput,
                        {
                          backgroundColor: theme.colors.backgroundCard,
                          borderColor: theme.colors.backgroundBorder,
                          color: theme.colors.textPrimary,
                        },
                      ]}
                      placeholderTextColor={theme.colors.textHint}
                      accessibilityLabel="Search fandom vocabulary"
                    />
                    {filteredFandomVocab.length > 0 && (
                      <View style={styles.chipRow}>
                        {filteredFandomVocab.slice(0, 20).map((f) =>
                          renderChip({
                            label: f,
                            active: false,
                            onPress: () => selectFandom(f),
                          })
                        )}
                      </View>
                    )}
                    {filteredFandomVocab.length === 0 && fandomInput.trim() !== '' && (
                      <Text style={[styles.emptyText, { color: theme.colors.textMeta }]}>
                        No matching fandoms in library
                      </Text>
                    )}
                    {fandomVocabulary.length === 0 && (
                      <Text style={[styles.emptyText, { color: theme.colors.textMeta }]}>
                        No fandoms in library yet
                      </Text>
                    )}
                  </>
                )}
              </>
            ) : draft.kind === 'book' ? (
              <Text style={[styles.emptyText, { color: theme.colors.textMeta }]}>
                AO3 filters are not available for books.
              </Text>
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.textMeta }]}>
                Select Fanfic to filter by AO3 fields.
              </Text>
            )}

            <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />

            {/* ── Section: Tags ── */}
            {hasTaggedReadables && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>TAGS</Text>

                {/* Active tag chips with toggle cycle */}
                {activeTags.length > 0 && (
                  <View style={styles.chipRow}>
                    {activeTags.map(({ tag, mode }) =>
                      renderChip({
                        label: mode === 'exclude' ? `not ${tag}` : tag,
                        active: true,
                        activeVariant: mode === 'exclude' ? 'exclude' : 'include',
                        onPress: () => cycleTag(tag),
                        onRemove: () => removeTag(tag),
                        accessibilityLabel: `${mode === 'include' ? 'Include' : 'Exclude'} tag: ${tag}. Tap to cycle.`,
                      })
                    )}
                  </View>
                )}

                {/* Tag search input */}
                <TextInput
                  placeholder="Search tags…"
                  value={tagInput}
                  onChangeText={setTagInput}
                  style={[
                    styles.searchInput,
                    {
                      backgroundColor: theme.colors.backgroundCard,
                      borderColor: theme.colors.backgroundBorder,
                      color: theme.colors.textPrimary,
                    },
                  ]}
                  placeholderTextColor={theme.colors.textHint}
                  accessibilityLabel="Search tag vocabulary"
                />

                {/* Tag vocabulary chips */}
                {filteredTagVocab.length > 0 && (
                  <View style={styles.chipRow}>
                    {filteredTagVocab.slice(0, 30).map((tag) =>
                      renderChip({
                        label: tag,
                        active: false,
                        onPress: () => addIncludeTag(tag),
                      })
                    )}
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />
              </>
            )}

            {/* ── Section: Sort ── */}
            <Text style={[styles.sectionTitle, { color: theme.colors.textMeta }]}>SORT</Text>
            {sortOptions.map((opt) => {
              const key = sortOptionKey(opt);
              const isSelected = currentSortKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.radioRow}
                  onPress={() => setSort(opt)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={opt.label}
                >
                  <View style={[styles.radioOuter, { borderColor: isSelected ? theme.colors.kindBook : theme.colors.backgroundBorder }]}>
                    {isSelected && (
                      <View style={[styles.radioInner, { backgroundColor: theme.colors.kindBook }]} />
                    )}
                  </View>
                  <Text style={[styles.radioLabel, { color: theme.colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

          </ScrollView>

          {/* ── Footer ── */}
          <View
            style={[
              styles.footer,
              { backgroundColor: theme.colors.backgroundInput },
            ]}
          >
            <Text style={[styles.liveCount, { color: theme.colors.textMeta }]}>
              {liveCount === 1 ? '1 readable matches' : `${liveCount} readables match`}
            </Text>
            <View style={styles.footerActions}>
              <TouchableOpacity
                onPress={handleClearAll}
                style={styles.clearButton}
                accessibilityLabel="Clear all filters"
                accessibilityRole="button"
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.textBody }]}>
                  Clear all
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                style={[styles.applyButton, { backgroundColor: theme.colors.kindBook }]}
                accessibilityLabel="Apply filters"
                accessibilityRole="button"
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Chip styles (shared) ───────────────────────────────────────────────────────

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipRemove: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchInput: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 7 : 5,
    minHeight: 44,
    gap: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  radioLabel: {
    flex: 1,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  liveCount: {
    textAlign: 'center',
    fontSize: 12,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  applyButton: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
