import { appError, isAppError, type AppErrorCode } from '../errors';

const CODES: AppErrorCode[] = [
  'db',
  'network',
  'parse',
  'validation',
  'not_found',
  'rate_limited',
  'restricted',
  'unsupported_version',
  'wrong_passphrase',
  'storage_full',
];

describe('isAppError', () => {
  it.each(CODES)('accepts %s', (code) => {
    expect(isAppError(appError(code, 'message'))).toBe(true);
  });

  it('accepts retryAfterMs', () => {
    expect(isAppError(appError('rate_limited', 'slow down', 5000))).toBe(true);
  });

  it.each([
    ['an Error', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'db'],
    ['an unknown code', { code: 'nope', message: 'x' }],
    ['an inherited code', { code: 'toString', message: 'x' }],
    ['a missing message', { code: 'db' }],
    ['a non-number retryAfterMs', { code: 'db', message: 'x', retryAfterMs: '5' }],
  ])('rejects %s', (_label, value) => {
    expect(isAppError(value)).toBe(false);
  });
});

describe('appError', () => {
  it('omits retryAfterMs when not given', () => {
    expect(appError('db', 'failed')).toEqual({ code: 'db', message: 'failed' });
    expect('retryAfterMs' in appError('db', 'failed')).toBe(false);
  });
});
