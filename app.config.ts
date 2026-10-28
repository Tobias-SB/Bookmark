import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Bookmark',
  slug: 'bookmark',
  version: '1.0.0',
  scheme: 'bookmark',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-router',
      {
        // src/app/ holds theme code (spec §17); without this, expo-router would treat it as the routes root.
        root: './app',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      },
    ],
    'expo-splash-screen',
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
