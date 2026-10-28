import { Platform } from 'react-native';

export interface PlatformCapabilities {
  platform: 'android' | 'ios' | 'web';   // 'ios' from Phase 6 (§2.4)
  canFetchAo3: boolean;          // native (android, ios)
  canReceiveShares: boolean;     // native: android intent filter, ios share extension
  canAppLock: boolean;           // native
  canScanBarcodes: boolean;      // native
  canSearchGoogleBooks: boolean; // native; web if spike S5 passes
  canFetchCoverImages: boolean;  // automatic book covers: native; web if spike S9 passes
  canDownloadImageLinks: boolean;// AO3 page images and pasted image links: native
  canShowSupportLink: boolean;   // Ko-fi link: web only; always false in Play and App Store builds
  canTipInApp: boolean;          // store tips: android with ANDROID_TIPS_ENABLED; ios with IOS_TIPS_ENABLED
  isInstalledWebApp: boolean;    // web: display-mode standalone; native: true
}

const platform = Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';
const isNative = platform !== 'web';

function isStandaloneWebApp(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
}

export const capabilities: PlatformCapabilities = {
  platform,
  canFetchAo3: isNative,
  canReceiveShares: isNative,
  canAppLock: isNative,
  canScanBarcodes: isNative,
  // Web stays off until spikes S5 and S9 pass.
  canSearchGoogleBooks: isNative,
  canFetchCoverImages: isNative,
  canDownloadImageLinks: isNative,
  canShowSupportLink: !isNative,
  // shortcut: no tip build flags exist yet; wire ANDROID_TIPS_ENABLED / IOS_TIPS_ENABLED when tips are built (§12.12).
  canTipInApp: false,
  isInstalledWebApp: isNative || isStandaloneWebApp(),
};
