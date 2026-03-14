// src/app/database/DatabaseProvider.tsx
// §12 — Opens the SQLite database once, runs migrations, and shares the
// instance via React context. DatabaseProvider always renders its children —
// the loading/error gate is the consumer's responsibility (AppGate).
//
// Provider tree position (outermost → innermost):
//   SafeAreaProvider → PaperProvider → QueryClientProvider
//   → DatabaseProvider → AppGate → NavigationContainer

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as SQLite from 'expo-sqlite';

import { isAppError, type AppError } from '../../shared/types/errors';
import { runMigrations } from './migrationRunner';

const DB_NAME = 'bookmark.db';

// ── Context ───────────────────────────────────────────────────────────────────

interface DatabaseContextValue {
  db: SQLite.SQLiteDatabase | null;
  isReady: boolean;
  error: AppError | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isReady: false,
  error: null,
});

// ── Provider ──────────────────────────────────────────────────────────────────

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [state, setState] = useState<DatabaseContextValue>({
    db: null,
    isReady: false,
    error: null,
  });

  // Hold a ref so the cleanup can close the DB if the provider unmounts before
  // init completes (rare in production but important for tests).
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        dbRef.current = db;
        await runMigrations(db);

        if (!cancelled) {
          setState({ db, isReady: true, error: null });
        }
      } catch (cause) {
        if (!cancelled) {
          const error: AppError = isAppError(cause)
            ? cause
            : {
                code: 'db',
                message:
                  cause instanceof Error
                    ? cause.message
                    : 'Database initialisation failed.',
              };

          setState({ db: null, isReady: false, error });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={state}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns the initialised SQLiteDatabase for use in repository calls.
 * Throws a developer-facing error if called before the database is ready —
 * this should never happen when NavigationContainer is correctly gated on isReady.
 * Never call this hook inside DatabaseProvider's init path.
 */
export function useDatabase(): SQLite.SQLiteDatabase {
  const { db, isReady } = useContext(DatabaseContext);

  if (!isReady || db === null) {
    throw new Error(
      'useDatabase() was called before the database is ready. ' +
        'Ensure NavigationContainer is gated behind AppGate (isReady).',
    );
  }

  return db;
}

/**
 * Returns the full context value including isReady and error.
 * Intended for AppGate — not for screens or hooks that use the database.
 */
export function useDatabaseContext(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
