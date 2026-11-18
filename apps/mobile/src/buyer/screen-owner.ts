import { useRef } from 'react';

import { useSession } from '../auth/session';

/**
 * Whose a private screen is. A screen kept in the navigation stack outlives a sign-out, and its route
 * parameter may name the first Account's private resource: it belongs to the credential it first served
 * and to no later one. 'none': nobody is signed in (a guest, or a session still being restored). 'owner':
 * the credential that first served this screen. 'other': a different credential is signed in now, so the
 * screen must show and ask for nothing. Call it in the route's own component, which stays mounted while
 * its body is swapped, never in the body.
 */
export function useScreenOwner(): 'none' | 'owner' | 'other' {
  const { session } = useSession();
  const current = session.status === 'signedIn' ? session.token : null;
  const owner = useRef<string | null>(null);
  // The first signed-in credential, including one restored after a cold start with this screen's link.
  if (current !== null && owner.current === null) owner.current = current;
  if (current === null) return 'none';
  return current === owner.current ? 'owner' : 'other';
}
