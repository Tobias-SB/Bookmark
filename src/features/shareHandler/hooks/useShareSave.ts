// src/features/shareHandler/hooks/useShareSave.ts
// Feature 6 — Share Extension.
// Mutation hook that creates a readable from a share intent.
// Follows the useCreateReadable pattern (useMutation via useCreateReadable).
//
// When metadata is null (user saved during the loading phase before metadata
// arrived), the canonical URL is used as the title placeholder. The user can
// edit the entry later.

import { useState } from 'react';

import type { AppError } from '../../../shared/types/errors';
import type { ReadableStatus } from '../../readables/domain/readable';
import type { ProcessedAo3Url } from '../../../shared/utils/ao3Url';
import type { MetadataResult } from '../../metadata/services/types';
import { useCreateReadable } from '../../readables/hooks/useCreateReadable';
import type { CreateReadableInput } from '../../readables/data/readableRepository';

export interface ShareSaveInput {
  processedUrl: ProcessedAo3Url;
  status: ReadableStatus;
  /** null when the user saves before metadata has finished loading. */
  metadata: MetadataResult['data'] | null;
}

export interface UseShareSaveResult {
  save: (input: ShareSaveInput) => Promise<void>;
  isSaving: boolean;
  error: AppError | null;
  /** The title of the readable that was created. Null before a successful save. */
  savedTitle: string | null;
}

export function useShareSave(): UseShareSaveResult {
  const { createAsync, isPending } = useCreateReadable();
  const [error, setError] = useState<AppError | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  async function save({ processedUrl, status, metadata }: ShareSaveInput): Promise<void> {
    setError(null);

    const input: CreateReadableInput = metadata
      ? buildInputFromMetadata(processedUrl, status, metadata)
      : buildMinimalInput(processedUrl, status);

    try {
      const created = await createAsync(input);
      setSavedTitle(created.title);
    } catch (err) {
      setError(err as AppError);
    }
  }

  return { save, isSaving: isPending, error, savedTitle };
}

// ── Input builders ────────────────────────────────────────────────────────────

function buildMinimalInput(
  processedUrl: ProcessedAo3Url,
  status: ReadableStatus,
): CreateReadableInput {
  return {
    kind: 'fanfic',
    title: processedUrl.canonicalUrl,
    status,
    sourceType: 'ao3',
    sourceId: processedUrl.workId,
    sourceUrl: processedUrl.canonicalUrl,
  };
}

function buildInputFromMetadata(
  processedUrl: ProcessedAo3Url,
  status: ReadableStatus,
  data: MetadataResult['data'],
): CreateReadableInput {
  return {
    kind: 'fanfic',
    title: data.title ?? processedUrl.canonicalUrl,
    author: data.author ?? null,
    status,
    sourceType: 'ao3',
    sourceId: data.sourceId ?? processedUrl.workId,
    sourceUrl: data.sourceUrl ?? processedUrl.canonicalUrl,
    summary: data.summary ?? null,
    tags: data.tags ?? [],
    totalUnits: data.totalUnits ?? null,
    isComplete: data.isComplete ?? null,
    availableChapters: data.availableChapters ?? null,
    wordCount: data.wordCount ?? null,
    fandom: data.fandom ?? [],
    relationships: data.relationships ?? [],
    rating: data.rating ?? null,
    archiveWarnings: data.archiveWarnings ?? [],
    seriesName: data.seriesName ?? null,
    seriesPart: data.seriesPart ?? null,
    seriesTotal: data.seriesTotal ?? null,
    authorType: data.authorType ?? null,
    publishedAt: data.publishedAt ?? null,
    ao3UpdatedAt: data.ao3UpdatedAt ?? null,
    isAbandoned: data.isAbandoned ?? false,
  };
}
