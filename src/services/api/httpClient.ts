// src/services/api/httpClient.ts

export interface HttpResponse<T> {
  data: T;
}

export type HttpClientErrorKind = 'NETWORK' | 'TIMEOUT' | 'ABORTED' | 'HTTP' | 'UNKNOWN';

export class HttpClientError extends Error {
  public readonly kind: HttpClientErrorKind;
  public readonly statusCode?: number;

  constructor(args: {
    kind: HttpClientErrorKind;
    message: string;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'HttpClientError';
    this.kind = args.kind;
    this.statusCode = args.statusCode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).cause = args.cause;
  }
}

function mergeAbortSignals(parent?: AbortSignal, timeoutMs?: number) {
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (parent) {
      parent.removeEventListener('abort', onParentAbort);
    }
  };

  const onParentAbort = () => {
    try {
      controller.abort();
    } finally {
      cleanup();
    }
  };

  if (parent) {
    if (parent.aborted) {
      controller.abort();
    } else {
      parent.addEventListener('abort', onParentAbort);
    }
  }

  if (timeoutMs != null && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } finally {
        cleanup();
      }
    }, timeoutMs);
  }

  return { signal: controller.signal, cleanup };
}

/**
 * Real HTTP GET for JSON APIs.
 * Screens must never call fetch() directly — only this http client.
 */
export async function httpGetJson<T>(
  url: string,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const { signal, cleanup } = mergeAbortSignals(options?.signal, options?.timeoutMs ?? 10_000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      throw new HttpClientError({
        kind: 'HTTP',
        statusCode: res.status,
        message: `HTTP ${res.status} for GET ${url}`,
      });
    }

    try {
      const json = (await res.json()) as T;
      return json;
    } catch (cause) {
      throw new HttpClientError({
        kind: 'UNKNOWN',
        message: `Failed to parse JSON for GET ${url}`,
        cause,
      });
    }
  } catch (cause: unknown) {
    if (cause instanceof HttpClientError) throw cause;

    // Abort / timeout show up as AbortError in fetch implementations
    if (
      cause &&
      typeof cause === 'object' &&
      'name' in cause &&
      (cause as any).name === 'AbortError'
    ) {
      // We can't perfectly distinguish “user abort” vs “timeout abort” here without extra bookkeeping;
      // we treat it as TIMEOUT if a timeout was requested, otherwise ABORTED.
      const kind: HttpClientErrorKind = options?.timeoutMs ? 'TIMEOUT' : 'ABORTED';
      throw new HttpClientError({
        kind,
        message:
          kind === 'TIMEOUT'
            ? `Request timed out for GET ${url}`
            : `Request aborted for GET ${url}`,
        cause,
      });
    }

    throw new HttpClientError({
      kind: 'NETWORK',
      message: `Network error for GET ${url}`,
      cause,
    });
  } finally {
    cleanup();
  }
}

/**
 * Fake HTTP client that simply waits a bit and returns the provided data.
 * Kept for any places you still want a mocked call.
 */
export async function fakeHttpGet<T>(data: T, delayMs = 400): Promise<HttpResponse<T>> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { data };
}
