// src/features/fanfic/services/ao3ReadableService.ts
import { useQuery } from '@tanstack/react-query';
import { fetchAo3Metadata } from '@src/features/readables/services/ao3MetadataService';
import type { Ao3WorkMetadata } from '@src/features/readables/services/ao3MetadataService';
import type { Ao3ApiError } from '@src/services/api/ao3Api';

export function useAo3Lookup(url: string) {
  return useQuery<Ao3WorkMetadata, Ao3ApiError>({
    queryKey: ['ao3Lookup', url],
    enabled: !!url.trim(),
    queryFn: () => fetchAo3Metadata(url),
  });
}
