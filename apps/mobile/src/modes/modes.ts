import { useAccountContext } from '../api/bootstrap';
import { useSession } from '../auth/session';

export const MODES = ['buyer', 'seller', 'courier'] as const;
export type Mode = (typeof MODES)[number];

// Diagnostic labels (development builds only); product UI names modes through the catalogue.
export const MODE_LABEL: Record<Mode, string> = {
  buyer: 'Buyer',
  seller: 'Seller Companion',
  courier: 'Courier',
};

/** Where each mode starts. Buyer is the app's own entry; Courier is still a diagnostic shell. */
export const MODE_HOME = {
  buyer: '/home/for-you',
  seller: '/seller',
  courier: '/courier',
} as const satisfies Record<Mode, string>;

/**
 * The modes this account may open. AVAILABLE modes are backend truth; the ACTIVE mode (ui-store) is
 * only which of them is on screen, and switching between them never touches the session (founder
 * decision, WO-001).
 *
 * - Buyer is every account's base mode (ADU-PRD-01 S6.3).
 * - Seller Companion (WO-020) only when a signed-in session's bootstrap says
 *   `account_context.seller_companion.available` is true: the Account holds a Seller relationship
 *   whose role has a MOBILE permission (WO-API-001A). In development builds too: diagnostics never
 *   grant it, and nothing stored on the device (a remembered mode or store) can.
 * - Courier stays a development diagnostic shell with no data (the server says false until its
 *   MOBILE authorisation exists, WO-API-001B); `devDiagnostics` unlocks only that shell.
 */
export function resolveAvailableModes({
  devDiagnostics,
  signedIn,
  sellerCompanion,
}: {
  devDiagnostics: boolean;
  signedIn: boolean;
  sellerCompanion: boolean | undefined;
}): readonly Mode[] {
  const modes: Mode[] = ['buyer'];
  if (signedIn && sellerCompanion === true) modes.push('seller');
  if (devDiagnostics) modes.push('courier');
  return modes;
}

export function useAvailableModes(): readonly Mode[] {
  const { session } = useSession();
  const context = useAccountContext();
  return resolveAvailableModes({
    devDiagnostics: __DEV__,
    signedIn: session.status === 'signedIn',
    sellerCompanion: context?.seller_companion?.available,
  });
}
