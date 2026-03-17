// src/shared/utils/ao3RateLimit.ts
// Shared rate-limit delay for AO3 HTTP requests.
//
// Both the WIP checker (wipUpdateChecker.ts) and the future CSV importer
// must use this function so the delay policy is defined in one place.
//
// Spec: Appendix C of BOOKMARK_V2_IMPLEMENTATION_GUIDE.md
// Delay: 2000ms ± 500ms jitter → range 1500–2500ms.

export async function ao3RateLimitDelay(): Promise<void> {
  const ms = 2000 + (Math.random() * 1000 - 500); // 1500–2500ms
  return new Promise(resolve => setTimeout(resolve, ms));
}
