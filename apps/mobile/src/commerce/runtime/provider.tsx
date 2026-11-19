import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useSession } from '../../auth/session';
import { disabledCartAdapter } from '../adapters/disabled';
import type { CartAdapter, Scope } from '../cart/port';
import { resolveAdapter, SHIPPED_COMMERCE_MODE, type CommerceMode } from './mode';
import { createRuntime, type CommerceRuntime, type SessionIdentity } from './runtime';

export type CommerceContextValue = Readonly<{
  runtime: CommerceRuntime;
  /** The scope of the session on screen: null while the session is being restored. */
  scope: Scope | null;
  /** The adapter being served, which is the disabled one unless the build and the run allow a fixture. */
  adapter: CartAdapter;
}>;

const CommerceContext = createContext<CommerceContextValue | null>(null);

/**
 * The provider with the build and the run named explicitly. Tests use it to allow a fixture adapter; the
 * production provider below passes the shipped constant and `__DEV__`.
 */
export function CommerceProviderCore({
  adapter,
  build,
  dev,
  children,
}: {
  adapter: CartAdapter;
  build: CommerceMode;
  dev: boolean;
  children: ReactNode;
}) {
  const { session } = useSession();
  // One runtime for this provider: the single owner of the epoch, the scope and the pending adds.
  const [runtime] = useState(createRuntime);
  const identity: SessionIdentity | null =
    session.status === 'restoring'
      ? null
      : session.status === 'signedIn'
        ? { kind: 'account', token: session.token }
        : { kind: 'guest', token: null };
  // While rendering, not in an effect: no frame is drawn that pairs an old scope with a new credential.
  // A render that React throws away leaves the runtime one identity ahead of what is on screen; the older
  // tree's scope then refuses to send until the new one commits, which is the safe side.
  runtime.observe(identity);
  const served = resolveAdapter({ requested: adapter, build, dev });
  const scope = runtime.scope;
  const value = useMemo<CommerceContextValue>(() => ({ runtime, scope, adapter: served }), [runtime, scope, served]);
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

/** The production provider. It reads the shipped mode and `__DEV__` each time it renders. */
export function CommerceProvider({ adapter, children }: { adapter: CartAdapter; children: ReactNode }) {
  return (
    <CommerceProviderCore adapter={adapter} build={SHIPPED_COMMERCE_MODE} dev={__DEV__}>
      {children}
    </CommerceProviderCore>
  );
}

/** The commerce context, or null outside a provider. */
export const useCommerceContext = (): CommerceContextValue | null => useContext(CommerceContext);

/** The adapter in use: the disabled one outside any provider. */
export const useCommerce = (): CartAdapter => useContext(CommerceContext)?.adapter ?? disabledCartAdapter;
