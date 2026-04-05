// src/features/ao3Auth/hooks/useAo3Session.ts
// Query hook for the current AO3 session state.
// Returns { session, isLoggedIn, isLoading }.
//
// Query key: ['ao3Session'] — invalidated by useAo3Logout and Ao3LoginScreen
// after a successful login or logout.

import { useQuery } from '@tanstack/react-query';

import type { Ao3Session } from '../domain/ao3Session';
import { getAo3Session } from '../services/ao3CookieService';

export const AO3_SESSION_QUERY_KEY = ['ao3Session'] as const;

export interface Ao3SessionState {
  session: Ao3Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}

export function useAo3Session(): Ao3SessionState {
  const { data: session = null, isLoading } = useQuery({
    queryKey: AO3_SESSION_QUERY_KEY,
    queryFn: getAo3Session,
    // Session state does not change unless the user explicitly logs in or out,
    // so no stale/refetch behaviour is needed.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    session,
    isLoggedIn: session !== null,
    isLoading,
  };
}
