// src/shared/utils/dates.ts
// Shared date utilities used across features.
// Uses the device's local calendar date — not UTC wall-clock — so that
// isoToLocalDate and localMidnightUTC always yield the correct local date.

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats an ISO 8601 string as a locale-aware long date.
 * Example: "15 January 2025" (en-GB) / "January 15, 2025" (en-US)
 * Used for: dateAdded, publishedAt, ao3UpdatedAt, notesUpdatedAt.
 * Note: date-only ISO strings (YYYY-MM-DD) are parsed as UTC and may
 * render as the previous day in negative-UTC-offset locales.
 */
export function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats an ISO 8601 string as a locale-aware date + time.
 * Example: "15 Jan 2025, 14:32"
 * Used for: checkedAt timestamps in UpdatesScreen where time context matters.
 */
export function formatDisplayDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
