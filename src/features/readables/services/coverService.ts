// src/features/readables/services/coverService.ts
// Cover image file management for the readables feature.
// First file in src/features/readables/services/ — establishes this pattern.
//
// Uses the expo-file-system v2 class-based API (File, Directory, Paths).
// Most operations are synchronous native calls via JSI; only downloadFileAsync
// is truly async. Functions retain async signatures for backward compatibility
// with callers that await them.
//
// Storage directory: ${Paths.document}/covers/
// Filenames: ${Crypto.randomUUID()}{ext}

import * as Crypto from 'expo-crypto';
import { File, Directory, Paths } from 'expo-file-system';

import type { AppError } from '../../../shared/types/errors';

// ── Helpers ───────────────────────────────────────────────────────────────────

function coversDir(): Directory {
  return new Directory(Paths.document, 'covers');
}

function isLocalCoverUri(uri: string | null): boolean {
  if (!uri) return false;
  return uri.startsWith(coversDir().uri);
}

// ── ensureCoversDir ───────────────────────────────────────────────────────────

/** Creates the covers directory if it does not already exist. */
export async function ensureCoversDir(): Promise<void> {
  const dir = coversDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
}

// ── saveLocalCover ────────────────────────────────────────────────────────────

/**
 * Copies an image picker URI to the persistent covers directory.
 * Returns the new persistent local URI.
 */
export async function saveLocalCover(sourceUri: string): Promise<string> {
  await ensureCoversDir();
  const source = new File(sourceUri);
  // file.extension includes the leading dot (e.g. '.jpg'); fall back for
  // content:// URIs on Android where the extension may not be in the path.
  const ext = source.extension || '.jpg';
  const dest = new File(coversDir(), `${Crypto.randomUUID()}${ext}`);
  try {
    source.copy(dest);
  } catch (err) {
    throw {
      code: 'db',
      message: `Failed to copy cover image: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies AppError;
  }
  return dest.uri;
}

// ── downloadCover ─────────────────────────────────────────────────────────────

/**
 * Downloads a remote image URL to the covers directory.
 * Returns the local URI on success, or null on failure.
 * File.downloadFileAsync throws on non-2xx responses — no manual status check needed.
 */
export async function downloadCover(remoteUrl: string): Promise<string | null> {
  try {
    await ensureCoversDir();
    // Use a UUID filename so multiple downloads never collide.
    // .jpg is a safe fallback — Google Books thumbnails are always JPEG.
    const dest = new File(coversDir(), `${Crypto.randomUUID()}.jpg`);
    const result = await File.downloadFileAsync(remoteUrl, dest);
    return result.uri;
  } catch {
    return null;
  }
}

// ── deleteCoverFile ───────────────────────────────────────────────────────────

/**
 * Deletes a local cover file. Safe to call with any URI:
 * - Remote URLs (e.g. Google Books import URLs) are silently ignored.
 * - null is silently ignored.
 * - Non-existent files are silently ignored (guarded by .exists check).
 */
export async function deleteCoverFile(coverUri: string | null): Promise<void> {
  if (!isLocalCoverUri(coverUri)) return;
  try {
    const file = new File(coverUri as string);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Non-fatal — file may already be gone.
  }
}
