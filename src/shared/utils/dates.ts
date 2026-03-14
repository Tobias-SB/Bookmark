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
