// src/features/readables/ui/QuickAddScreen.tsx
// First step when adding a new readable. Presented with presentation: 'modal'
// from the root stack navigator, giving a bottom-up slide-in feel.
//
// New pattern: first "multi-step intake modal screen" in the codebase.
// The screen captures kind + optional metadata before sending the user to
// AddEditScreen for final review and save.
//
// Book flow:
//   Kind = Book → search field → results list (up to 5 per page) →
//   user selects edition → navigate to AddEditReadable with prefill.
//   "Load more results" appends the next page to the existing list.
//   "Change search" is done by editing the query field and searching again.
//   "Skip, add manually" navigates to AddEditReadable with sourceType = 'manual'.
//
// Fanfic flow:
//   Kind = Fanfic → AO3 URL field → Import → duplicate check →
//   navigate to AddEditReadable with prefill on success.
//   Inline error message on failure (e.g. locked work).
//   "Skip, add manually" navigates to AddEditReadable with sourceType = 'manual'.
//
// After a successful save in AddEditReadable, navigation.popToTop() dismisses
// both QuickAddReadable and AddEditReadable in one motion, returning to Library.

import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Divider,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';

import type { AddEditPrefill, RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { BookSearchResult, MetadataResult } from '../../metadata';
import { useImportMetadata } from '../../metadata';
import { useFindAo3Duplicate } from '../hooks/useFindAo3Duplicate';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickAddReadable'>;

const AO3_WORK_PREFIX = 'https://archiveofourown.org/works/';

function buildPrefillFromMetadataData(
  data: MetadataResult['data'],
  kind: 'book' | 'fanfic',
): AddEditPrefill {
  return {
    kind,
    sourceType: kind === 'fanfic' ? 'ao3' : 'book_provider',
    sourceId: data.sourceId ?? null,
    isbn: data.isbn ?? null,
    coverUrl: data.coverUrl ?? null,
    availableChapters: data.availableChapters ?? null,
    title: data.title,
    author: data.author,
    summary: data.summary,
    tags: data.tags,
    progressTotal: data.progressTotal,
    sourceUrl: data.sourceUrl,
    isComplete: data.isComplete,
  };
}

export function QuickAddScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const headerHeight = useHeaderHeight();

  const [kind, setKind] = useState<'book' | 'fanfic'>('book');

  // ── Book search state ──────────────────────────────────────────────────────
  const [bookQuery, setBookQuery] = useState('');
  const [allResults, setAllResults] = useState<BookSearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextStartIndex, setNextStartIndex] = useState(0);
  const [noResultsMessage, setNoResultsMessage] = useState<string | null>(null);

  // ── Fanfic state ───────────────────────────────────────────────────────────
  const [ao3Url, setAo3Url] = useState('');
  const [ao3Error, setAo3Error] = useState<string | null>(null);

  const { searchBooks, importMetadata, isImporting } = useImportMetadata();
  const { findAo3Duplicate } = useFindAo3Duplicate();

  const bookQueryRef = useRef<RNTextInput>(null);

  // ── Kind change clears all per-kind state ──────────────────────────────────

  function handleKindChange(newKind: 'book' | 'fanfic') {
    setKind(newKind);
    setBookQuery('');
    setAllResults([]);
    setHasMore(false);
    setNextStartIndex(0);
    setNoResultsMessage(null);
    setAo3Url('');
    setAo3Error(null);
  }

  // ── Book search ────────────────────────────────────────────────────────────

  async function handleBookSearch(startIndex: number) {
    const query = bookQuery.trim();
    if (!query) return;

    if (startIndex === 0) {
      setAllResults([]);
      setHasMore(false);
      setNoResultsMessage(null);
    }

    const response = await searchBooks(query, startIndex);

    if (response.results.length === 0) {
      setNoResultsMessage(response.errors[0] ?? 'No results found. Try a different search.');
    } else {
      setAllResults((prev) =>
        startIndex === 0 ? response.results : [...prev, ...response.results],
      );
      setHasMore(response.hasMore);
      setNextStartIndex(response.nextStartIndex);
      setNoResultsMessage(null);
    }
  }

  function handleSelectBookResult(result: BookSearchResult) {
    const prefill = buildPrefillFromMetadataData(result.metadata, 'book');
    navigation.navigate('AddEditReadable', { prefill });
  }

  // ── AO3 import ────────────────────────────────────────────────────────────

  async function handleAo3Import() {
    setAo3Error(null);
    const result = await importMetadata('fanfic', ao3Url.trim());

    if (Object.keys(result.data).length === 0) {
      setAo3Error(
        "Couldn't fetch this work — it may require an AO3 login. Check the URL and try again.",
      );
      return;
    }

    const prefill = buildPrefillFromMetadataData(result.data, 'fanfic');

    if (result.data.sourceId) {
      let duplicate = null;
      try {
        duplicate = await findAo3Duplicate(result.data.sourceId);
      } catch {
        // Fail open — proceed with prefill.
      }

      if (duplicate) {
        Alert.alert(
          'Already in library',
          `"${duplicate.title}" is already in your library.`,
          [
            {
              text: 'Open existing',
              onPress: () => navigation.navigate('ReadableDetail', { id: duplicate!.id }),
            },
            {
              text: 'Continue anyway',
              onPress: () => navigation.navigate('AddEditReadable', { prefill }),
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }
    }

    navigation.navigate('AddEditReadable', { prefill });
  }

  // ── Skip to manual add ────────────────────────────────────────────────────

  function handleSkip() {
    navigation.navigate('AddEditReadable', {
      prefill: {
        kind,
        sourceType: 'manual',
        sourceId: null,
        isbn: null,
        coverUrl: null,
        availableChapters: null,
      },
    });
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const canSearch = !isImporting && bookQuery.trim().length > 0;
  const canImportAo3 = !isImporting && ao3Url.trim().startsWith(AO3_WORK_PREFIX);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Kind selector ──────────────────────────────────────────────────── */}
        <View style={styles.kindSection}>
          <Text
            variant="labelLarge"
            style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}
          >
            What are you adding?
          </Text>
          <SegmentedButtons
            value={kind}
            onValueChange={(v) => handleKindChange(v as 'book' | 'fanfic')}
            buttons={[
              { value: 'book', label: 'Book' },
              { value: 'fanfic', label: 'Fanfic' },
            ]}
          />
        </View>

        <Divider style={styles.kindDivider} />

        {/* ── Book path ─────────────────────────────────────────────────────── */}
        {kind === 'book' && (
          <>
            <Text
              variant="bodyMedium"
              style={[styles.pathHint, { color: theme.colors.textSecondary }]}
            >
              Search for your book to pre-fill its details, or skip to enter them manually.
            </Text>

            {/* Search row */}
            <View style={styles.searchRow}>
              <TextInput
                ref={bookQueryRef}
                label="Title, author, or ISBN"
                value={bookQuery}
                onChangeText={(t) => {
                  setBookQuery(t);
                  if (noResultsMessage) setNoResultsMessage(null);
                }}
                returnKeyType="search"
                onSubmitEditing={() => { if (canSearch) void handleBookSearch(0); }}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.searchInput]}
                mode="outlined"
                editable={!isImporting}
                accessibilityLabel="Search query: title, author, or ISBN"
              />
              <Button
                mode="contained"
                onPress={() => void handleBookSearch(0)}
                loading={isImporting && allResults.length === 0}
                disabled={!canSearch}
                style={styles.searchButton}
                accessibilityLabel="Search Google Books"
              >
                Search
              </Button>
            </View>

            {/* No results message */}
            {noResultsMessage !== null && (
              <HelperText type="info" visible style={styles.noResultsText}>
                {noResultsMessage}
              </HelperText>
            )}

            {/* Results list */}
            {allResults.length > 0 && (
              <>
                <Divider style={styles.resultsDivider} />
                {allResults.map((result, index) => (
                  <React.Fragment key={`${result.isbn ?? result.displayTitle}-${index}`}>
                    <TouchableRipple
                      onPress={() => handleSelectBookResult(result)}
                      accessibilityLabel={`Select ${result.displayTitle}`}
                      accessibilityRole="button"
                    >
                      <View style={styles.resultItem}>
                        {result.coverUrl !== null ? (
                          <Image
                            source={{ uri: result.coverUrl }}
                            style={[
                              styles.resultCover,
                              { backgroundColor: theme.colors.surfaceVariant },
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.resultCover,
                              { backgroundColor: theme.colors.surfaceVariant },
                            ]}
                          />
                        )}
                        <View style={styles.resultDetails}>
                          <Text
                            variant="bodyLarge"
                            style={{ color: theme.colors.textPrimary }}
                            numberOfLines={2}
                          >
                            {result.displayTitle}
                          </Text>
                          {result.subtitle !== null && (
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.textSecondary }}
                              numberOfLines={1}
                            >
                              {result.subtitle}
                            </Text>
                          )}
                          {result.allContributors.length > 0 && (
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.textSecondary }}
                              numberOfLines={2}
                            >
                              {result.allContributors.join(', ')}
                            </Text>
                          )}
                          {result.displayInfo !== '' && (
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.textDisabled }}
                              numberOfLines={1}
                            >
                              {result.displayInfo}
                            </Text>
                          )}
                          {result.isbn !== null && (
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.textDisabled }}
                              numberOfLines={1}
                            >
                              ISBN: {result.isbn}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableRipple>
                    {index < allResults.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                <Divider />
              </>
            )}

            {/* Load more */}
            {allResults.length > 0 && hasMore && (
              <Button
                mode="text"
                onPress={() => void handleBookSearch(nextStartIndex)}
                loading={isImporting}
                disabled={isImporting}
                style={styles.loadMoreButton}
                accessibilityLabel="Load more results"
              >
                Load more results
              </Button>
            )}
          </>
        )}

        {/* ── Fanfic path ───────────────────────────────────────────────────── */}
        {kind === 'fanfic' && (
          <>
            <Text
              variant="bodyMedium"
              style={[styles.pathHint, { color: theme.colors.textSecondary }]}
            >
              Paste the AO3 work URL to import its details automatically, or skip to enter them manually.
            </Text>

            <TextInput
              label="AO3 Work URL"
              value={ao3Url}
              onChangeText={(t) => {
                setAo3Url(t);
                if (ao3Error) setAo3Error(null);
              }}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => { if (canImportAo3) void handleAo3Import(); }}
              style={styles.input}
              mode="outlined"
              editable={!isImporting}
              accessibilityLabel="AO3 work URL"
            />

            {ao3Error !== null && (
              <HelperText type="error" visible>
                {ao3Error}
              </HelperText>
            )}

            {isImporting ? (
              <View style={styles.importingRow}>
                <ActivityIndicator size="small" />
                <Text
                  variant="bodySmall"
                  style={[styles.importingLabel, { color: theme.colors.textSecondary }]}
                >
                  Fetching from AO3…
                </Text>
              </View>
            ) : (
              <Button
                mode="contained"
                onPress={() => void handleAo3Import()}
                disabled={!canImportAo3}
                style={styles.importButton}
                accessibilityLabel="Import from AO3"
              >
                Import from AO3
              </Button>
            )}
          </>
        )}

        {/* ── Skip to manual add — always reachable ─────────────────────────── */}
        <Divider style={styles.skipDivider} />
        <Button
          mode="text"
          onPress={handleSkip}
          disabled={isImporting}
          style={styles.skipButton}
          accessibilityLabel="Skip import and add manually"
        >
          Skip, add manually
        </Button>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  kindSection: { marginBottom: 12 },
  sectionLabel: { marginBottom: 8 },
  kindDivider: { marginBottom: 20 },
  pathHint: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  input: {},
  searchInput: { flex: 1 },
  searchButton: { alignSelf: 'center', marginTop: 4 },
  noResultsText: { marginBottom: 4 },
  resultsDivider: { marginTop: 8, marginBottom: 4 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  resultCover: { width: 40, height: 53, borderRadius: 3, flexShrink: 0 },
  resultDetails: { flex: 1, gap: 2 },
  loadMoreButton: { marginTop: 4, alignSelf: 'center' },
  importingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  importingLabel: {},
  importButton: { marginTop: 12 },
  skipDivider: { marginTop: 28, marginBottom: 4 },
  skipButton: { alignSelf: 'center' },
});
