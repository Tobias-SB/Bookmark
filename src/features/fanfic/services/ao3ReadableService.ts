// src/features/fanfic/services/ao3ReadableService.ts
import { useQuery } from '@tanstack/react-query';
import { fetchWorkByUrl } from '@src/services/api/ao3Api';
import type { Ao3Metadata } from '../types';

export function useAo3Lookup(url: string) {
  return useQuery<Ao3Metadata>({
    queryKey: ['ao3Lookup', url],
    enabled: !!url.trim(),
    queryFn: () => fetchWorkByUrl(url),
  });
}
