// src/shared/hooks/useSnackbar.ts
// Cross-feature hook for the standard Portal + Snackbar pattern.
// Extracts the snackbar message state and its open/close helpers so screens
// do not duplicate the same useState boilerplate.
//
// Usage in a screen:
//   const { snackbarMessage, showSnackbar, hideSnackbar } = useSnackbar();
//   // ...
//   showSnackbar(err.message);
//   // ...
//   <Portal>
//     <Snackbar visible={snackbarMessage !== null} onDismiss={hideSnackbar} duration={4000}>
//       {snackbarMessage ?? ''}
//     </Snackbar>
//   </Portal>
//
// NOTE: This establishes the first file pattern in src/shared/hooks/.
// Future cross-feature hooks should follow this file as a template.

import { useCallback, useState } from 'react';

export function useSnackbar() {
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const showSnackbar = useCallback((message: string) => {
    setSnackbarMessage(message);
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbarMessage(null);
  }, []);

  return { snackbarMessage, showSnackbar, hideSnackbar } as const;
}
