// src/shared/types/errors.ts
// §13 — Shared error type. Repositories and services catch raw errors and
// return or throw typed AppError values. Hooks surface AppError to UI.
// UI components do not inspect `code` for presentational logic unless the
// distinction meaningfully changes the display.

export type AppErrorCode = 'db' | 'network' | 'parse' | 'validation' | 'not_found' | 'ao3_restricted';

export interface AppError {
  code: AppErrorCode;
  message: string;
}

/** Type guard for AppError. Used by the repository and database layers. */
export function isAppError(value: unknown): value is AppError {
  return (
    value !== null &&
    typeof value === 'object' &&
    'code' in value &&
    'message' in value &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}
