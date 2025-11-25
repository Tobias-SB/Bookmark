// src/services/api/httpClient.ts
export interface HttpResponse<T> {
  data: T;
}

/**
 * Fake HTTP client that simply waits a bit and returns the provided data.
 */
export async function fakeHttpGet<T>(data: T, delayMs = 400): Promise<HttpResponse<T>> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { data };
}
