// src/features/shareHandler/hooks/useShareIntent.ts
// Feature 6 — Share Extension.
// New feature pattern: src/features/shareHandler/ (first file in this folder).
//
// useShareIntent — watches expo-share-intent for incoming share intents and
// navigates to the ShareHandler screen when a valid AO3 work URL is detected.
// Invalid or non-AO3 URLs are rejected with an Alert.
//
// ShareIntentHandler — headless component that calls useShareIntent(). Rendered
// inside NavigationContainer (as a sibling of Stack.Navigator in RootNavigator)
// so useNavigation() is available. Returns null — no visible UI.

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShareIntentContext } from 'expo-share-intent';

import type { RootStackParamList } from '../../../app/navigation/types';
import { processAo3Url } from '../../../shared/utils/ao3Url';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function useShareIntent(): void {
  const navigation = useNavigation<Nav>();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  // Guard ref: prevents double-navigation if the intent remains truthy between
  // resetShareIntent() being called and the state actually clearing.
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (!hasShareIntent) {
      // Intent cleared — allow the next intent to be handled.
      hasHandledRef.current = false;
      return;
    }
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    // Browser URL shares populate webUrl; plain-text shares populate text.
    const rawUrl = shareIntent.webUrl ?? shareIntent.text ?? '';
    const processed = rawUrl ? processAo3Url(rawUrl) : null;

    if (processed) {
      navigation.navigate('ShareHandler', { processedUrl: processed });
    } else {
      Alert.alert(
        'Unsupported URL',
        'Bookmark only supports AO3 work URLs.',
        [{ text: 'OK' }],
      );
    }

    resetShareIntent();
  }, [hasShareIntent, shareIntent, navigation, resetShareIntent]);
}

/**
 * Headless component. Renders null. Call inside NavigationContainer so that
 * useNavigation() resolves correctly. Placed as a sibling of Stack.Navigator
 * in RootNavigator.
 */
export function ShareIntentHandler(): null {
  useShareIntent();
  return null;
}
