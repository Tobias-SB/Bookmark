// src/features/ao3Auth/hooks/useAo3Logout.ts
// Mutation hook that clears the stored AO3 session and invalidates the session
// query so all consumers re-render with isLoggedIn = false.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { clearAo3Session } from '../services/ao3CookieService';
import { AO3_SESSION_QUERY_KEY } from './useAo3Session';

export function useAo3Logout() {
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await clearAo3Session();
      await queryClient.invalidateQueries({ queryKey: AO3_SESSION_QUERY_KEY });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return { logout, isLoggingOut };
}
