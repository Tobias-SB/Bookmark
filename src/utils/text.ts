// src/utils/text.ts
export function extractAo3WorkIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/works\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // ignore
  }
  return null;
}
