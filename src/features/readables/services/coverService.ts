// src/features/readables/services/coverService.ts
// Cover image file management for the readables feature.
// First file in src/features/readables/services/ — establishes this pattern.
//
// Pure async functions, no React hooks. Handles copying picker URIs, downloading
// remote URLs, and deleting local cover files from the app's covers directory.
//
// Storage directory: ${FileSystem.documentDirectory}covers/
// Filenames: ${Crypto.randomUUID()}.{ext}

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

// ── Helpers ───────────────────────────────────────────────────────────────────

function coversDir(): string {
  return `${FileSystem.documentDirectory}covers/`;
}

function isLocalCoverUri(uri: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith(coversDir());
}

function extFromUri(uri: string): string {
  const match = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

// ── ensureCoversDir ───────────────────────────────────────────────────────────

/** Creates the covers directory if it does not already exist. */
export async function ensureCoversDir(): Promise<void> {
  const dir = coversDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ── saveLocalCover ────────────────────────────────────────────────────────────

/**
 * Copies an image picker URI to the persistent covers directory.
 * Returns the new persistent URI.
 */
export async function saveLocalCover(sourceUri: string): Promise<string> {
  await ensureCoversDir();
  const ext = extFromUri(sourceUri);
  const filename = `${Crypto.randomUUID()}.${ext}`;
  const destUri = `${coversDir()}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

// ── downloadCover ─────────────────────────────────────────────────────────────

/**
 * Downloads a remote image URL to the covers directory.
 * Returns the local URI on success, or null on failure.
 */
export async function downloadCover(remoteUrl: string): Promise<string | null> {
  try {
    await ensureCoversDir();
    const ext = extFromUri(remoteUrl);
    const filename = `${Crypto.randomUUID()}.${ext}`;
    const destUri = `${coversDir()}${filename}`;
    const result = await FileSystem.downloadAsync(remoteUrl, destUri);
    if (result.status >= 200 && result.status < 300) {
      return result.uri;
    }
    // Download succeeded but non-2xx — clean up the empty file if created
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    return null;
  } catch {
    return null;
  }
}

// ── deleteCoverFile ───────────────────────────────────────────────────────────

/**
 * Deletes a local cover file. Safe to call with any URI:
 * - Remote URLs (e.g. Google Books import URLs) are silently ignored.
 * - null is silently ignored.
 * - Non-existent files are silently ignored (idempotent).
 */
export async function deleteCoverFile(coverUri: string | null): Promise<void> {
  if (!isLocalCoverUri(coverUri)) return;
  await FileSystem.deleteAsync(coverUri as string, { idempotent: true });
}
