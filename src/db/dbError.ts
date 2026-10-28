import { appError, isAppError, type AppError } from '@/shared/types/errors';

// Raw driver errors carry SQL and file paths, so they never leave the db layer (spec §15).
export function toDbError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const text = error instanceof Error ? error.message : String(error);
  return /SQLITE_FULL|disk is full|QuotaExceeded/i.test(text)
    ? appError('storage_full', 'Device storage is full')
    : appError('db', 'Database operation failed');
}

export async function guardDb<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw toDbError(error);
  }
}
