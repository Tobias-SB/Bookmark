// src/features/readables/hooks/useFindAo3Duplicate.ts
// Feature-internal hook (not exported from index.ts — only used by AddEditScreen).
// Wraps findReadableBySourceId for AO3 duplicate detection at import time (§6).

import { useDatabase } from '../../../app/database/DatabaseProvider';
import type { Readable } from '../domain/readable';
import { findReadableBySourceId } from '../data/readableRepository';

export interface UseFindAo3DuplicateResult {
  /**
   * Returns the existing readable with this AO3 sourceId, or null if none.
   * Throws if the database query fails — caller should catch and fail open.
   */
  findAo3Duplicate: (sourceId: string) => Promise<Readable | null>;
}

export function useFindAo3Duplicate(): UseFindAo3DuplicateResult {
  const db = useDatabase();

  async function findAo3Duplicate(sourceId: string): Promise<Readable | null> {
    return findReadableBySourceId(db, sourceId, 'ao3');
  }

  return { findAo3Duplicate };
}
