import { extractAo3WorkIdFromUrl } from '@src/utils/text';
import { httpGetText, HttpClientError } from './httpClient';

export type Ao3ApiErrorKind = 'LOCKED' | 'NETWORK' | 'SERVER' | 'INVALID_URL' | 'UNKNOWN';

export class Ao3ApiError extends Error {
  public readonly kind: Ao3ApiErrorKind;
  public readonly statusCode?: number;

  constructor(args: {
    kind: Ao3ApiErrorKind;
    message: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'Ao3ApiError';
    this.kind = args.kind;
    this.statusCode = args.statusCode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).cause = args.cause;
  }
}

export class Ao3ApiInvalidUrlError extends Ao3ApiError {
  constructor(url: string) {
    super({
      kind: 'INVALID_URL',
      message: `Invalid AO3 work URL: "${url}"`,
    });
    this.name = 'Ao3ApiInvalidUrlError';
  }
}

function buildCanonicalAo3WorkUrl(workId: string): string {
  // view_adult=true avoids the interstitial for adult works
  return `https://archiveofourown.org/works/${workId}?view_adult=true`;
}

function mapHttpClientError(err: HttpClientError): Ao3ApiError {
  if (err.kind === 'HTTP') {
    const status = err.statusCode ?? 0;

    // AO3 often blocks/returns 403/429 if it dislikes automated traffic
    if (status === 403 || status === 429) {
      return new Ao3ApiError({
        kind: 'LOCKED',
        statusCode: status,
        message:
          'This AO3 work could not be fetched (access restricted or rate-limited). It may require login.',
        cause: err,
      });
    }

    if (status >= 500) {
      return new Ao3ApiError({
        kind: 'SERVER',
        statusCode: status,
        message: `AO3 returned a server error (status ${status}).`,
        cause: err,
      });
    }

    // Other HTTP failures (404 etc.) treated as UNKNOWN; AO3 HTML can be weird.
    return new Ao3ApiError({
      kind: 'UNKNOWN',
      statusCode: status,
      message: `Failed to load AO3 work page (status ${status}).`,
      cause: err,
    });
  }

  if (err.kind === 'TIMEOUT' || err.kind === 'NETWORK') {
    return new Ao3ApiError({
      kind: 'NETWORK',
      message: 'Network error while fetching AO3 work page.',
      cause: err,
    });
  }

  return new Ao3ApiError({
    kind: 'UNKNOWN',
    message: 'Unexpected error while fetching AO3 work page.',
    cause: err,
  });
}

/**
 * Fetch the AO3 work HTML for a given work URL.
 *
 * Semantics:
 * - Throws Ao3ApiError(kind='INVALID_URL') when URL is not a work URL.
 * - Throws Ao3ApiError(kind='NETWORK'|'SERVER'|'LOCKED'|'UNKNOWN') for failures.
 * - Returns the canonical URL, workId, and HTML when successful.
 */
export async function fetchAo3WorkHtml(rawUrl: string): Promise<{
  workId: string;
  canonicalUrl: string;
  html: string;
}> {
  const trimmed = rawUrl.trim();
  const workId = extractAo3WorkIdFromUrl(trimmed);
  if (!workId) {
    throw new Ao3ApiInvalidUrlError(trimmed);
  }

  const canonicalUrl = buildCanonicalAo3WorkUrl(workId);

  try {
    const { text } = await httpGetText(canonicalUrl, {
      timeoutMs: 14_000,
      headers: {
        // AO3 is sensitive to scraping; a polite UA helps.
        'User-Agent': 'BookmarkApp/1.0 (personal reading tracker)',
      },
    });

    return { workId, canonicalUrl, html: text };
  } catch (cause: unknown) {
    if (cause instanceof HttpClientError) {
      throw mapHttpClientError(cause);
    }

    throw new Ao3ApiError({
      kind: 'UNKNOWN',
      message: 'Unexpected error while fetching AO3 work page.',
      cause,
    });
  }
}
