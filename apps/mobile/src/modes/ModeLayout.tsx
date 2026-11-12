import { Redirect, Slot } from 'expo-router';
import { useEffect } from 'react';

import { useAccountContext } from '../api/bootstrap';
import { useSession } from '../auth/session';
import { useUiStore } from '../state/ui-store';
import { resolveAvailableModes, type Mode } from './modes';

/** The modes this account may open now (modes.ts): the session and the server's account_context. */
export function useAvailableModes(): readonly Mode[] {
  const { session } = useSession();
  const context = useAccountContext();
  return resolveAvailableModes({
    devDiagnostics: __DEV__,
    signedIn: session.status === 'signedIn',
    sellerCompanion: context?.seller_companion?.available,
  });
}

/**
 * Entering a mode sets `activeMode` and leaving clears it; the only other writer is
 * clearSession. Returns whether the account has the mode at all.
 */
export function useModeActivation(mode: Mode): boolean {
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

  return allowed;
}

/**
 * The guard for the Seller Companion and Courier diagnostic shells: a mode the account
 * does not have never renders. (Buyer has its own navigator: app/(buyer)/_layout.tsx.)
 */
export function ModeLayout({ mode }: { mode: Mode }) {
  return useModeActivation(mode) ? <Slot /> : <Redirect href="/" />;
}
