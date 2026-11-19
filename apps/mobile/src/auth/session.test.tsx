import { QueryClient, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import type { DeviceStorage } from '../device/device-storage';
import { AppProviders } from '../providers/AppProviders';
import { useUiStore } from '../state/ui-store';
import { installFakeApi } from '../testing/fake-api';
import { restoreSession, useSession } from './session';
import { secureSessionStorage, type SessionStorage } from './session-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function fakeStorage(token: string | null): jest.Mocked<SessionStorage> {
  return {
    read: jest.fn(async () => token),
    write: jest.fn(async (_token: string) => undefined),
    clear: jest.fn(async () => undefined),
  };
}

describe('SecureStore session storage', () => {
  it('keeps the opaque token under one SecureStore key and nowhere else', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('opaque-token');

    await secureSessionStorage.write('opaque-token');
    await expect(secureSessionStorage.read()).resolves.toBe('opaque-token');
    await secureSessionStorage.clear();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('adulis.session.token', 'opaque-token');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('adulis.session.token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('adulis.session.token');
  });
});

describe('startup hydration', () => {
  it('restores a stored token as signed in, verbatim', async () => {
    await expect(restoreSession(fakeStorage('opaque-token'))).resolves.toEqual({
      status: 'signedIn',
      token: 'opaque-token',
    });
  });

  it('starts signed out when nothing is stored', async () => {
    await expect(restoreSession(fakeStorage(null))).resolves.toEqual({ status: 'signedOut' });
  });

  it('starts signed out on an unreadable credential without deleting it', async () => {
    const storage = fakeStorage(null);
    storage.read.mockRejectedValue(new Error('keychain locked'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(restoreSession(storage)).resolves.toEqual({ status: 'signedOut' });
    // A transient failure must not sign the user out for good; only clearSession deletes.
    expect(storage.clear).not.toHaveBeenCalled();
  });
});

describe('root providers', () => {
  let api: ReturnType<typeof useSession> | undefined;

  function SessionProbe() {
    api = useSession();
    return <Text>{api.session.status}</Text>;
  }

  function QueryProbe() {
    // The single test query: proves QueryClientProvider is wired, nothing more.
    const probe = useQuery({ queryKey: ['probe'], queryFn: async () => 'query ok' });
    return <Text>{probe.data ?? 'query pending'}</Text>;
  }

  async function boot(storage: SessionStorage, extra?: ReactNode) {
    // gcTime Infinity: no garbage-collection timer outlives the test.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await render(
      <AppProviders queryClient={queryClient} sessionStorage={storage}>
        <SessionProbe />
        {extra}
      </AppProviders>,
    );
    expect(await screen.findByText('signedIn')).toBeOnTheScreen();
    return queryClient;
  }

  beforeEach(() => useUiStore.setState({ activeMode: null }));
  // A failing assertion must not leave a pending Save behind for the tests after it.
  afterEach(() => useUiStore.setState({ pendingSave: null }));

  it('boots, hydrates the session and serves queries', async () => {
    await boot(fakeStorage('opaque-token'), <QueryProbe />);
    expect(await screen.findByText('query ok')).toBeOnTheScreen();
  });

  it('clears credential, server cache and active mode through one boundary', async () => {
    const storage = fakeStorage('opaque-token');
    const queryClient = await boot(storage);
    queryClient.setQueryData(['server-state'], 'cached for the signed-in account');
    useUiStore.setState({ activeMode: 'seller' });

    await act(() => api!.clearSession());

    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('signedOut')).toBeOnTheScreen();
    expect(queryClient.getQueryData(['server-state'])).toBeUndefined();
    expect(useUiStore.getState().activeMode).toBeNull();
  });

  // Another Account signing in over a live session is not reachable through the screens (they leave once signed
  // in), but the session must not depend on that: nothing the first Account held stays in memory.
  it('signing in as another Account over a live session forgets what the first one held', async () => {
    const storage = fakeStorage('first-token');
    const queryClient = await boot(storage);
    queryClient.setQueryData(['server-state'], 'cached for the first account');
    useUiStore.setState({ activeMode: 'seller' });

    await act(() => api!.signIn('second-token'));

    expect(storage.write).toHaveBeenCalledWith('second-token');
    expect(screen.getByText('signedIn')).toBeOnTheScreen();
    expect(queryClient.getQueryData(['server-state'])).toBeUndefined();
    expect(useUiStore.getState().activeMode).toBeNull();
  });

  // The app never makes this call (every verification mints a new credential, so signing in again is "another
  // credential" and clears); it pins the guard in `signIn` itself, that only a DIFFERENT credential clears.
  it('a sign-in call with the credential already held changes nothing', async () => {
    const queryClient = await boot(fakeStorage('first-token'));
    queryClient.setQueryData(['server-state'], 'cached');
    useUiStore.setState({ activeMode: 'buyer' });

    await act(() => api!.signIn('first-token'));

    expect(queryClient.getQueryData(['server-state'])).toBe('cached');
    expect(useUiStore.getState().activeMode).toBe('buyer');
  });

  it('a guest signing in keeps what a guest holds: the public reads and its own pending Save', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    await render(
      <AppProviders queryClient={queryClient} sessionStorage={fakeStorage(null)}>
        <SessionProbe />
      </AppProviders>,
    );
    await screen.findByText('signedOut');
    queryClient.setQueryData(['public-read'], 'cached for a guest');
    const pendingSave = {
      nonce: 'n1',
      target: { type: 'PRODUCT_POST' as const, ref: 'p1' },
      surface: 'PRODUCT_DETAIL' as const,
      sceneRef: null,
    };
    useUiStore.setState({ pendingSave });

    await act(() => api!.signIn('first-token'));

    expect(screen.getByText('signedIn')).toBeOnTheScreen();
    expect(queryClient.getQueryData(['public-read'])).toBe('cached for a guest');
    expect(useUiStore.getState().pendingSave).toEqual(pendingSave);
  });

  it('runs one device registration at a time: concurrent callers share the attempt in flight', async () => {
    const fake = installFakeApi();
    const entries = new Map<string, string>();
    const deviceStorage: DeviceStorage = {
      readId: async () => entries.get('id') ?? null,
      writeId: async (id) => void entries.set('id', id),
      readRegistered: async () => entries.get('registered') ?? null,
      writeRegistered: async (id) => void entries.set('registered', id),
      readRegistrationKey: async () => entries.get('key') ?? null,
      writeRegistrationKey: async (key) => void entries.set('key', key),
      clearRegistrationKey: async () => void entries.delete('key'),
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    await render(
      <AppProviders queryClient={queryClient} sessionStorage={fakeStorage(null)} deviceStorage={deviceStorage}>
        <SessionProbe />
      </AppProviders>,
    );
    await screen.findByText('signedOut');

    let results: boolean[] = [];
    await act(async () => {
      results = await Promise.all([api!.ensureDeviceRegistered(), api!.ensureDeviceRegistered()]);
    });
    expect(results).toEqual([true, true]);
    expect(fake.callsTo('POST /v1/devices')).toHaveLength(1);
    // Finished: the next call finds the install registered and sends nothing.
    await expect(api!.ensureDeviceRegistered()).resolves.toBe(false);
    expect(fake.callsTo('POST /v1/devices')).toHaveLength(1);
  });

  it('does not claim a sign-out when the credential could not be deleted', async () => {
    const storage = fakeStorage('opaque-token');
    storage.clear.mockRejectedValue(new Error('delete failed'));
    await boot(storage);

    await expect(act(() => api!.clearSession())).rejects.toThrow('delete failed');
    expect(screen.getByText('signedIn')).toBeOnTheScreen();
  });
});
