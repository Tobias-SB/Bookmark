// src/features/readables/ui/QuickAddScreen.tsx
// UI Phase 7 — QuickAddScreen redesign.
// First step when adding a new readable. Presented with presentation: 'modal'
// from the root stack navigator, giving a bottom-up slide-in feel.
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
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';

import type { AddEditPrefill, RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import type { BookSearchResult, MetadataResult } from '../../metadata';
import { useImportMetadata } from '../../metadata';
import { useFindAo3Duplicate } from '../hooks/useFindAo3Duplicate';
import { useAo3Session, useAo3Login } from '../../ao3Auth';

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
    totalUnits: data.totalUnits,
    sourceUrl: data.sourceUrl,
    isComplete: data.isComplete,
  };
}

export function QuickAddScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const headerHeight = useHeaderHeight();

  const [kind, setKind] = useState<'book' | 'fanfic'>('book');
  const [urlFocused, setUrlFocused] = useState(false);

  // ── Book search state ──────────────────────────────────────────────────────
  const [bookQuery, setBookQuery] = useState('');
  const [allResults, setAllResults] = useState<BookSearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextStartIndex, setNextStartIndex] = useState(0);
  const [noResultsMessage, setNoResultsMessage] = useState<string | null>(null);

  // ── Fanfic state ───────────────────────────────────────────────────────────
  const [ao3Url, setAo3Url] = useState('');
  const [ao3Error, setAo3Error] = useState<string | null>(null);
  // True when the last import attempt failed due to the work being restricted.
  // Used to show a login CTA alongside the error message.
  const [ao3Restricted, setAo3Restricted] = useState(false);

  const { searchBooks, importMetadata, isImporting } = useImportMetadata();
  const { findAo3Duplicate } = useFindAo3Duplicate();
  const { isLoggedIn } = useAo3Session();
  const { navigateToLogin } = useAo3Login();

  const bookQueryRef = useRef<RNTextInput>(null);
  // Set to true when we navigate away to login so we can retry on focus return.
  const pendingRetryRef = useRef(false);

  // Re-trigger the import automatically when the user returns from logging in.
  useFocusEffect(
    React.useCallback(() => {
      if (pendingRetryRef.current && isLoggedIn) {
        pendingRetryRef.current = false;
        void handleAo3Import();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]),
  );

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
    setAo3Restricted(false);
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
    setAo3Restricted(false);
    const result = await importMetadata('fanfic', ao3Url.trim());

    if (result.isRestricted) {
      if (!isLoggedIn) {
        // Prompt the user to log in — the login CTA is rendered alongside the error.
        setAo3Error(
          "This work is restricted — it's only visible to logged-in AO3 users.",
        );
        setAo3Restricted(true);
        pendingRetryRef.current = true;
      } else {
        // Already logged in but still restricted — nothing more we can do.
        setAo3Error(
          "This work is restricted — it's only visible to logged-in AO3 users. You can still add it manually.",
        );
      }
      return;
    }

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
      style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Kind selector ──────────────────────────────────────────────────── */}
        <Text style={[styles.kindLabel, { color: theme.colors.textMeta }]}>
          What are you adding?
        </Text>
        <View style={styles.kindRow}>
          {/* Book button */}
          <TouchableOpacity
            onPress={() => handleKindChange('book')}
            style={[
              styles.kindButton,
              kind === 'book'
                ? {
                    backgroundColor: theme.colors.kindBookSubtle,
                    borderColor: theme.colors.kindBookBorder,
                  }
                : {
                    backgroundColor: theme.colors.backgroundInput,
                    borderColor: theme.colors.backgroundBorder,
                  },
            ]}
            accessibilityLabel="Book"
            accessibilityRole="button"
            accessibilityState={{ selected: kind === 'book' }}
          >
            <View
              style={[
                styles.kindDot,
                { backgroundColor: kind === 'book' ? theme.colors.kindBook : theme.colors.backgroundBorder },
              ]}
            />
            <Text
              style={[
                styles.kindButtonText,
                { color: kind === 'book' ? theme.colors.kindBook : theme.colors.textBody },
              ]}
            >
              Book
            </Text>
          </TouchableOpacity>

          {/* Fanfic button */}
          <TouchableOpacity
            onPress={() => handleKindChange('fanfic')}
            style={[
              styles.kindButton,
              kind === 'fanfic'
                ? {
                    backgroundColor: theme.colors.kindFanficSubtle,
                    borderColor: theme.colors.kindFanficBorder,
                  }
                : {
                    backgroundColor: theme.colors.backgroundInput,
                    borderColor: theme.colors.backgroundBorder,
                  },
            ]}
            accessibilityLabel="Fanfic"
            accessibilityRole="button"
            accessibilityState={{ selected: kind === 'fanfic' }}
          >
            <View
              style={[
                styles.kindDot,
                { backgroundColor: kind === 'fanfic' ? theme.colors.kindFanfic : theme.colors.backgroundBorder },
              ]}
            />
            <Text
              style={[
                styles.kindButtonText,
                { color: kind === 'fanfic' ? theme.colors.kindFanfic : theme.colors.textBody },
              ]}
            >
              Fanfic
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />

        {/* ── Book path ─────────────────────────────────────────────────────── */}
        {kind === 'book' && (
          <>
            <Text style={[styles.pathHint, { color: theme.colors.textBody }]}>
              Search for your book to pre-fill its details, or skip to enter them manually.
            </Text>

            {/* Search row */}
            <View style={styles.searchRow}>
              <RNTextInput
                ref={bookQueryRef}
                placeholder="Title, author, or ISBN"
                value={bookQuery}
                onChangeText={(t) => {
                  setBookQuery(t);
                  if (noResultsMessage) setNoResultsMessage(null);
                }}
                returnKeyType="search"
                onSubmitEditing={() => { if (canSearch) void handleBookSearch(0); }}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.backgroundCard,
                    borderColor: theme.colors.backgroundBorder,
                    color: theme.colors.textPrimary,
                    ...theme.shadows.small,
                  },
                ]}
                placeholderTextColor={theme.colors.textHint}
                editable={!isImporting}
                accessibilityLabel="Search query: title, author, or ISBN"
              />
              <TouchableOpacity
                onPress={() => void handleBookSearch(0)}
                disabled={!canSearch}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.kindBook,
                    opacity: canSearch ? 1 : 0.5,
                    ...theme.shadows.button,
                  },
                ]}
                accessibilityLabel="Search Google Books"
                accessibilityRole="button"
              >
                {isImporting && allResults.length === 0 ? (
                  <ActivityIndicator size="small" color={theme.colors.colorWhite} />
                ) : (
                  <Text style={[styles.actionButtonText, { color: theme.colors.colorWhite }]}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* No results message */}
            {noResultsMessage !== null && (
              <Text style={[styles.infoText, { color: theme.colors.textMeta }]}>
                {noResultsMessage}
              </Text>
            )}

            {/* Results list */}
            {allResults.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder }]} />
                {allResults.map((result, index) => (
                  <TouchableOpacity
                    key={`${result.isbn ?? result.displayTitle}-${index}`}
                    onPress={() => handleSelectBookResult(result)}
                    style={[
                      styles.resultItem,
                      {
                        borderRadius: theme.radii.card,
                        backgroundColor: theme.colors.backgroundCard,
                        ...theme.shadows.small,
                      },
                    ]}
                    accessibilityLabel={`Select ${result.displayTitle}`}
                    accessibilityRole="button"
                  >
                    {result.coverUrl !== null ? (
                      <Image
                        source={{ uri: result.coverUrl }}
                        style={[
                          styles.resultCover,
                          { backgroundColor: theme.colors.backgroundInput },
                        ]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.resultCover,
                          { backgroundColor: theme.colors.backgroundInput },
                        ]}
                      />
                    )}
                    <View style={styles.resultDetails}>
                      <Text
                        style={[styles.resultTitle, { color: theme.colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {result.displayTitle}
                      </Text>
                      {result.subtitle !== null && (
                        <Text
                          style={[styles.resultSubtext, { color: theme.colors.textBody }]}
                          numberOfLines={1}
                        >
                          {result.subtitle}
                        </Text>
                      )}
                      {result.allContributors.length > 0 && (
                        <Text
                          style={[styles.resultSubtext, { color: theme.colors.textBody }]}
                          numberOfLines={2}
                        >
                          {result.allContributors.join(', ')}
                        </Text>
                      )}
                      {result.displayInfo !== '' && (
                        <Text
                          style={[styles.resultMeta, { color: theme.colors.textMeta }]}
                          numberOfLines={1}
                        >
                          {result.displayInfo}
                        </Text>
                      )}
                      {result.isbn !== null && (
                        <Text
                          style={[styles.resultMeta, { color: theme.colors.textMeta }]}
                          numberOfLines={1}
                        >
                          ISBN: {result.isbn}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Load more */}
            {allResults.length > 0 && hasMore && (
              <TouchableOpacity
                onPress={() => void handleBookSearch(nextStartIndex)}
                disabled={isImporting}
                style={[styles.loadMoreButton, { opacity: isImporting ? 0.5 : 1 }]}
                accessibilityLabel="Load more results"
                accessibilityRole="button"
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color={theme.colors.kindBook} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: theme.colors.kindBook }]}>
                    Load more results
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Fanfic path ───────────────────────────────────────────────────── */}
        {kind === 'fanfic' && (
          <>
            <Text style={[styles.pathHint, { color: theme.colors.textBody }]}>
              Paste the AO3 work URL to import its details automatically, or skip to enter them manually.
            </Text>

            <RNTextInput
              placeholder="https://archiveofourown.org/works/…"
              value={ao3Url}
              onChangeText={(t) => {
                setAo3Url(t);
                if (ao3Error) setAo3Error(null);
                if (ao3Restricted) setAo3Restricted(false);
              }}
              onFocus={() => setUrlFocused(true)}
              onBlur={() => setUrlFocused(false)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => { if (canImportAo3) void handleAo3Import(); }}
              style={[
                styles.urlInput,
                {
                  backgroundColor: urlFocused ? theme.colors.backgroundCard : theme.colors.backgroundInput,
                  borderColor: urlFocused ? theme.colors.kindBookBorder : theme.colors.backgroundBorder,
                  color: theme.colors.textPrimary,
                },
              ]}
              placeholderTextColor={theme.colors.textHint}
              editable={!isImporting}
              accessibilityLabel="AO3 work URL"
            />

            {ao3Error !== null && (
              <View>
                <Text style={[styles.errorText, { color: theme.colors.danger }]}>
                  {ao3Error}
                </Text>
                {ao3Restricted && !isLoggedIn && (
                  <TouchableOpacity
                    onPress={() => {
                      navigateToLogin();
                    }}
                    style={[
                      styles.loginCtaButton,
                      {
                        backgroundColor: theme.colors.kindFanficSubtle,
                        borderColor: theme.colors.kindFanficBorder,
                      },
                    ]}
                    accessibilityLabel="Log in to AO3 to import this work"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.loginCtaText, { color: theme.colors.kindFanfic }]}>
                      Log in to AO3 to import it
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isImporting ? (
              <View style={styles.importingRow}>
                <ActivityIndicator size="small" color={theme.colors.kindBook} />
                <Text style={[styles.importingLabel, { color: theme.colors.textMeta }]}>
                  Fetching from AO3…
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => void handleAo3Import()}
                disabled={!canImportAo3}
                style={[
                  styles.actionButtonFull,
                  {
                    backgroundColor: theme.colors.kindBook,
                    opacity: canImportAo3 ? 1 : 0.5,
                    ...theme.shadows.button,
                  },
                ]}
                accessibilityLabel="Import from AO3"
                accessibilityRole="button"
              >
                <Text style={[styles.actionButtonText, { color: theme.colors.colorWhite }]}>Import from AO3</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Skip to manual add — always reachable ─────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: theme.colors.backgroundBorder, marginTop: 24 }]} />
        <TouchableOpacity
          onPress={handleSkip}
          disabled={isImporting}
          style={[styles.skipButton, { opacity: isImporting ? 0.5 : 1 }]}
          accessibilityLabel="Skip import and add manually"
          accessibilityRole="button"
        >
          <Text style={[styles.skipText, { color: theme.colors.kindBook }]}>
            Skip, add manually
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  kindLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  kindButton: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kindButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    marginVertical: 16,
  },

  pathHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  actionButton: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  actionButtonFull: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  infoText: {
    fontSize: 13,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
  },
  loginCtaButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 8,
  },
  loginCtaText: {
    fontSize: 13,
    fontWeight: '600',
  },

  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    overflow: 'hidden',
    marginBottom: 8,
    gap: 12,
  },
  resultCover: { width: 40, height: 53, borderRadius: 4, flexShrink: 0 },
  resultDetails: { flex: 1, gap: 2 },
  resultTitle: { fontSize: 15, fontWeight: '500' },
  resultSubtext: { fontSize: 13 },
  resultMeta: { fontSize: 12 },

  loadMoreButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },

  urlInput: {
    height: 46,
    borderRadius: 11,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 4,
  },
  importingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  importingLabel: { fontSize: 13 },

  skipButton: {
    alignSelf: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
