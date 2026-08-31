/**
 * lib/UpgradeGate.tsx -- the one place `UPGRADE_REQUIRED` can happen.
 *
 * D-103's second half. `UPGRADE_REQUIRED` is one of the twelve states
 * (lib/states.ts) and was UNREACHABLE: the only thing that can produce it is
 * `client_status` on `GET /v1/bootstrap`, and nothing read that field. A state
 * in a closed vocabulary that no code path can enter is a state the demo
 * renders and the product never does.
 *
 * S3's rule for it is absolute -- "reload prompt, NO OTHER CONTENT" -- so this
 * gate sits above the router rather than inside a screen. A router that still
 * rendered its routes underneath would be showing content to a client the
 * server has just said it will not serve.
 *
 * THE SERVER DECIDES. The console does not compare `min_supported_client`
 * against its own version and form an opinion; it renders the verdict the
 * server sent. Version comparison in a client is how a client decides it is
 * fine.
 *
 * UPGRADE_RECOMMENDED is deliberately NOT handled here: it is not a blocking
 * state and has no entry in the twelve-state vocabulary, so inventing a
 * banner for it would be inventing a state (S3, line 111 -- the set is
 * closed). It is available on `useMarket().clientStatus` for whichever screen
 * the CEO rules should carry it.
 */
import type { ReactNode } from 'react';
import { ScreenState } from '../components/ScreenState';
import { useMarket } from './market';

export function UpgradeGate({ children }: { children: ReactNode }) {
  const { clientStatus } = useMarket();
  if (clientStatus === 'UPGRADE_REQUIRED') {
    return (
      <main className="screen">
        <ScreenState state="UPGRADE_REQUIRED" />
      </main>
    );
  }
  return <>{children}</>;
}
