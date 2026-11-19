import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '../../auth/session';
import type { SessionStorage } from '../../auth/session-storage';
import type { DeviceStorage } from '../../device/device-storage';
import type { CartAdapter } from '../cart/port';
import type { CommerceMode } from '../runtime/mode';
import { CommerceProviderCore } from '../runtime/provider';

/** A session credential store in memory, for tests. */
export function fakeSessionStorage(token: string | null): SessionStorage {
  let held = token;
  return {
    read: async () => held,
    write: async (next) => void (held = next),
    clear: async () => void (held = null),
  };
}

/** A device store in memory, for tests. */
export function fakeDeviceStorage(): DeviceStorage {
  const entries = new Map<string, string>();
  return {
    readId: async () => entries.get('id') ?? null,
    writeId: async (id) => void entries.set('id', id),
    readRegistered: async () => entries.get('registered') ?? null,
    writeRegistered: async (id) => void entries.set('registered', id),
    readRegistrationKey: async () => entries.get('key') ?? null,
    writeRegistrationKey: async (key) => void entries.set('key', key),
    clearRegistrationKey: async () => void entries.delete('key'),
  };
}

export type SessionApi = ReturnType<typeof useSession>;

/**
 * Renders `children` under the app's real session provider and a query client, inside the commerce
 * provider with the build and the run named explicitly (a fixture adapter is served only when both
 * allow it). Resolves once the session has been restored.
 */
export async function renderWithCommerce(
  children: ReactNode,
  options: { adapter: CartAdapter; build?: CommerceMode; dev?: boolean; token?: string | null },
) {
  const { adapter, build = 'fixture', dev = true, token = null } = options;
  const session: { current: SessionApi | null } = { current: null };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const storage = fakeSessionStorage(token);
  const deviceStorage = fakeDeviceStorage();
  function Bridge() {
    session.current = useSession();
    return null;
  }
  const tree = (kids: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={storage} deviceStorage={deviceStorage}>
        <CommerceProviderCore adapter={adapter} build={build} dev={dev}>
          <Bridge />
          {kids}
        </CommerceProviderCore>
      </SessionProvider>
    </QueryClientProvider>
  );
  const view = await render(tree(children));
  await waitFor(() => expect(session.current?.session.status).not.toBe('restoring'));
  return {
    session,
    queryClient,
    view,
    /** Replaces what is rendered inside the same providers, so a screen can be unmounted and mounted again. */
    show: (kids: ReactNode) => view.rerender(tree(kids)),
  };
}
