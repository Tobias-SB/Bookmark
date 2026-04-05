export default ({ config }) => ({
  ...config,
  plugins: [
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow Bookmark to access your photo library to set cover images.',
      },
    ],
    'expo-secure-store',
    // Feature 6: Share Extension — handles AO3 URLs shared from other apps.
    // iOS: activates for web URLs and web pages shared from Safari/Chrome.
    // Android: accepts text/plain intents (Chrome and other browsers send URLs as plain text).
    // Requires an EAS development build — not available in Expo Go.
    [
      'expo-share-intent',
      {
        iosActivationRules: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsWebPageWithMaxCount: 1,
        },
        androidIntentFilters: ['text/plain'],
      },
    ],
  ],
  extra: {
    googleBooksApiKeyAndroid: process.env.GOOGLE_BOOKS_API_KEY_ANDROID ?? '',
    googleBooksApiKeyIos: process.env.GOOGLE_BOOKS_API_KEY_IOS ?? '',
    // SHA-1 signing certificate fingerprint for the Android API key restriction.
    // Format: AA:BB:CC:... (colon-separated hex, as shown by keytool / gradlew signingReport).
    googleBooksAndroidCert: process.env.GOOGLE_BOOKS_ANDROID_CERT ?? '',
    eas: {
      projectId: 'cb4bf8c3-c5f9-468a-ae2a-afb862ecd41f',
    },
  },
});
