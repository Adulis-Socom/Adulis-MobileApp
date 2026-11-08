import { Redirect, Slot } from 'expo-router';
import { useEffect } from 'react';

import { useUiStore } from '../state/ui-store';
import { useAvailableModes, type Mode } from './modes';

/**
 * Every route of a mode passes through here: a mode the account does not have never
 * renders. Entering a mode sets `activeMode` and leaving clears it; the only other writer
 * is clearSession.
 */
export function ModeLayout({ mode }: { mode: Mode }) {
  const allowed = useAvailableModes().includes(mode);
  const setActiveMode = useUiStore((state) => state.setActiveMode);

  useEffect(() => {
    if (!allowed) return;
    setActiveMode(mode);
    return () => {
      // Only clear our own mode: on a switch the next mode may already have taken over.
      if (useUiStore.getState().activeMode === mode) setActiveMode(null);
    };
  }, [allowed, mode, setActiveMode]);

  return allowed ? <Slot /> : <Redirect href="/" />;
}
