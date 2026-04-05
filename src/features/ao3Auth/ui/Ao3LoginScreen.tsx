// src/features/ao3Auth/ui/Ao3LoginScreen.tsx
// AO3 login modal — renders a WebView pointing to the AO3 login page.
// Detects successful login via URL change and persists the session.
//
// SPIKE NOTE:
//   This implementation assumes Path A (sharedCookiesEnabled={true} causes the
//   OS cookie jar to carry the session automatically for subsequent fetch calls).
//   If the spike reveals that Path A does not work:
//     1. Install @react-native-cookies/cookies
//     2. Import CookieManager from '@react-native-cookies/cookies'
//     3. In handleLoginSuccess, call:
//          const cookies = await CookieManager.get('https://archiveofourown.org');
//          const cookieValue = cookies['_otwarchive_session']?.value ?? '';
//          await saveAo3Session({ cookie: cookieValue, capturedAt: new Date().toISOString() });
//   Replace the Path A saveAo3Session call below accordingly.

import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Portal, Snackbar } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../app/theme';
import { saveAo3Session } from '../services/ao3CookieService';
import { AO3_SESSION_QUERY_KEY } from '../hooks/useAo3Session';

const AO3_LOGIN_URL = 'https://archiveofourown.org/users/login';

type Props = NativeStackScreenProps<RootStackParamList, 'Ao3Login'>;

export function Ao3LoginScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(true);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const loginHandledRef = useRef(false);

  async function handleLoginSuccess() {
    if (loginHandledRef.current) return;
    loginHandledRef.current = true;

    // PATH A: sharedCookiesEnabled — no manual cookie extraction needed.
    // Session presence is stored as a timestamp-only record.
    await saveAo3Session({ capturedAt: new Date().toISOString() });
    await queryClient.invalidateQueries({ queryKey: AO3_SESSION_QUERY_KEY });

    navigation.goBack();
    setSnackbarMessage('Logged in to AO3.');
  }

  function handleNavigationStateChange(navState: WebViewNavigation) {
    if (!navState.url) return;
    // AO3 redirects to the dashboard (or referrer) after a successful login.
    // Detect by the URL no longer being the login page.
    if (!navState.url.includes('/users/login') && !navState.loading) {
      void handleLoginSuccess();
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.backgroundPage }]}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            accessibilityLabel="Loading AO3 login page"
          />
        </View>
      )}
      <WebView
        source={{ uri: AO3_LOGIN_URL }}
        sharedCookiesEnabled={true}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        style={styles.webview}
        accessibilityLabel="AO3 login page"
      />
      <Portal>
        <Snackbar
          visible={snackbarMessage !== null}
          onDismiss={() => setSnackbarMessage(null)}
          duration={3000}
        >
          {snackbarMessage ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
});
