// src/features/ao3Auth/services/ao3CookieService.ts
// Persists the AO3 session via expo-secure-store.
//
// Storage key: 'ao3_session'
// Value: JSON.stringify(Ao3Session)
//
// All functions are async and never throw — errors are caught and treated as
// a missing session (same outcome as not being logged in).

import * as SecureStore from 'expo-secure-store';

import type { Ao3Session } from '../domain/ao3Session';

const STORAGE_KEY = 'ao3_session';

/** Returns the stored AO3 session, or null if none exists or storage fails. */
export async function getAo3Session(): Promise<Ao3Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Ao3Session;
    if (!parsed.capturedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persists the AO3 session. Silently ignores storage errors. */
export async function saveAo3Session(session: Ao3Session): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Silently fail — the user can retry the login action.
  }
}

/** Clears the stored AO3 session. Silently ignores storage errors. */
export async function clearAo3Session(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Nothing to clear or storage unavailable — treat as already cleared.
  }
}
