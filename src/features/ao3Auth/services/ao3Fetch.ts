// src/features/ao3Auth/services/ao3Fetch.ts
// Auth-aware drop-in replacement for fetch in all AO3 requests.
//
// Path A (sharedCookiesEnabled works):
//   The OS cookie jar automatically attaches the AO3 session cookie to every
//   fetch call. ao3Fetch just checks for session presence (for stale detection)
//   and makes the raw fetch — no Cookie header manipulation needed.
//
//
// Stale session detection:
//   If the response URL ends up at /users/login AND a session was active, the
//   cookie has expired. ao3Fetch clears the session so the caller (and the UI)
//   can detect the logged-out state on next query invalidation.

import { getAo3Session, clearAo3Session } from './ao3CookieService';

/**
 * Drop-in replacement for `fetch` used in all AO3 HTTP requests.
 * Attaches session credentials when available and detects stale sessions.
 */
export async function ao3Fetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const session = await getAo3Session();

  // ── PATH A: sharedCookiesEnabled — OS manages the cookie jar ────────────────
  // No header injection needed. Proceed with the raw fetch.
  // Session presence is used only for stale-detection below.

  const response = await fetch(url, options /* swap to fetchOptions for Path B */);

  // Stale session detection: AO3 redirects expired sessions to /users/login.
  // Clear the stored session so the UI reflects the logged-out state.
  if (session && response.url?.includes('/users/login')) {
    await clearAo3Session();
  }

  return response;
}
