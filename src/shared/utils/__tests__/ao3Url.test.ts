// src/shared/utils/__tests__/ao3Url.test.ts
// Unit tests for processAo3Url. Pure function — no mocks needed.

import { processAo3Url } from '../ao3Url';

describe('processAo3Url', () => {
  it('extracts work ID from a standard work URL', () => {
    const result = processAo3Url('https://archiveofourown.org/works/12345');
    expect(result).toEqual({
      canonicalUrl: 'https://archiveofourown.org/works/12345',
      workId: '12345',
      hasChapterPath: false,
    });
  });

  it('extracts work ID from a chapter URL and sets hasChapterPath true', () => {
    const result = processAo3Url('https://archiveofourown.org/works/12345/chapters/67890');
    expect(result).toEqual({
      canonicalUrl: 'https://archiveofourown.org/works/12345',
      workId: '12345',
      hasChapterPath: true,
    });
  });

  it('strips query parameters and returns the canonical URL', () => {
    const result = processAo3Url('https://archiveofourown.org/works/12345?view_adult=true');
    expect(result).not.toBeNull();
    expect(result!.canonicalUrl).toBe('https://archiveofourown.org/works/12345');
    expect(result!.workId).toBe('12345');
    expect(result!.hasChapterPath).toBe(false);
  });

  it('handles collection-scoped URLs', () => {
    const result = processAo3Url(
      'https://archiveofourown.org/collections/somecollection/works/12345',
    );
    expect(result).toEqual({
      canonicalUrl: 'https://archiveofourown.org/works/12345',
      workId: '12345',
      hasChapterPath: false,
    });
  });

  it('returns null for a non-AO3 URL', () => {
    expect(processAo3Url('https://www.fanfiction.net/s/12345/1/')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(processAo3Url('')).toBeNull();
  });
});
