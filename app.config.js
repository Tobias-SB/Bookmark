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
