// src/app/theme/index.ts
// §11 — Public API for the theme layer.
// useAppTheme() is the single point of theme consumption for all UI components.
// Import AppTheme for type annotations; useAppTheme() for runtime tokens.

export type { AppTheme } from './tokens';
export { makeTokens } from './tokens';

import { useTheme } from 'react-native-paper';
import { makeTokens } from './tokens';
import type { AppTheme } from './tokens';

export function useAppTheme(): AppTheme {
  const paperTheme = useTheme();
  return makeTokens(paperTheme);
}
