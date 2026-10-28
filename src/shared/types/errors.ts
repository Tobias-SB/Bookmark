export type AppErrorCode =
  | 'db' | 'network' | 'parse' | 'validation' | 'not_found'
  | 'rate_limited' | 'restricted' | 'unsupported_version' | 'wrong_passphrase' | 'storage_full';
export interface AppError { code: AppErrorCode; message: string; retryAfterMs?: number }

// A Record so the compiler fails if a code is added to the union but not here.
const APP_ERROR_CODES: Record<AppErrorCode, true> = {
  db: true,
  network: true,
  parse: true,
  validation: true,
  not_found: true,
  rate_limited: true,
  restricted: true,
  unsupported_version: true,
  wrong_passphrase: true,
  storage_full: true,
};

export function appError(code: AppErrorCode, message: string, retryAfterMs?: number): AppError {
  return retryAfterMs === undefined ? { code, message } : { code, message, retryAfterMs };
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null || !('code' in value) || !('message' in value)) return false;
  const retryAfterMs = 'retryAfterMs' in value ? value.retryAfterMs : undefined;
  return (
    typeof value.code === 'string' &&
    Object.hasOwn(APP_ERROR_CODES, value.code) &&
    typeof value.message === 'string' &&
    (retryAfterMs === undefined || typeof retryAfterMs === 'number')
  );
}
