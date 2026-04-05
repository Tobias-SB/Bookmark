// src/features/ao3Auth/domain/ao3Session.ts
// Domain type for a stored AO3 session.
//
// Path A (sharedCookiesEnabled works): `cookie` is undefined — the session
// cookie lives in the OS system cookie jar and flows through fetch automatically.
// This record acts as a presence-only flag: logged in vs. not logged in.
//
// Path B (sharedCookiesEnabled does not work): `cookie` holds the raw
// `_otwarchive_session` value, attached manually by ao3Fetch as a Cookie header.

export interface Ao3Session {
  /**
   * Path B only: the raw `_otwarchive_session` cookie value.
   * Absent in Path A — session is managed by the OS cookie jar.
   */
  cookie?: string;
  /** ISO 8601 timestamp of when the session was captured. */
  capturedAt: string;
}
