import { createContext, type ReactNode, useEffect, useState } from 'react';

import type { Db } from './Db';

export const DbContext = createContext<Db | null>(null);

type DatabaseProviderProps = {
  /** Opens and migrates the database. A stable reference: a new one reopens. */
  open: () => Promise<Db>;
  /** Called once the open attempt has succeeded or failed, for example to hide the splash screen. */
  onSettled?: () => void;
  renderError: (retry: () => void) => ReactNode;
  children: ReactNode;
};

type OpenState = { status: 'opening' } | { status: 'ready'; db: Db } | { status: 'failed' };

export function DatabaseProvider({ open, onSettled, renderError, children }: DatabaseProviderProps) {
  const [state, setState] = useState<OpenState>({ status: 'opening' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    open().then(
      (db) => {
        if (active) setState({ status: 'ready', db });
      },
      () => {
        if (active) setState({ status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [open, attempt]);

  const settled = state.status !== 'opening';
  useEffect(() => {
    if (settled) onSettled?.();
  }, [settled, onSettled]);

  if (state.status === 'opening') return null;
  if (state.status === 'failed') {
    return renderError(() => {
      setState({ status: 'opening' });
      setAttempt((n) => n + 1);
    });
  }
  return <DbContext value={state.db}>{children}</DbContext>;
}
