import { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useSession } from '../auth/session';
import type { SessionStorage } from '../auth/session-storage';
import type { DeviceStorage } from '../device/device-storage';
import { AppProviders } from '../providers/AppProviders';
import { useUiStore } from '../state/ui-store';
import {
  PENDING_CAP_MS,
  configurePendingRetention,
  credentialTag,
  pendingRetention,
  restorePending,
  type PendingSendRecord,
} from './pending-policy';

/**
 * Whether an unconfirmed message outlives its screen. The default is OFF: this is the first test of the
 * file on purpose (modules are fresh per file, so nothing has changed the switch yet), and turning the
 * retention on has to change this test in the same commit.
 */
describe('the retention switch', () => {
  it('is off by default: nothing of an unconfirmed message is kept when the screen is left', () => {
    expect(pendingRetention()).toBe('none');
  });
});

const record = (owner: string, over: Partial<PendingSendRecord> = {}): PendingSendRecord => ({
  owner,
  text: 'Kept words',
  productId: null,
  product: null,
  key: '01934b7e-0000-7000-8000-000000000001',
  startedAt: 1_000_000,
  attempts: 1,
  baseline: { newestSentAt: null, edgeIds: [] },
  ...over,
});
const REF = 'c0000000-0000-4000-8000-000000000001';

describe('what is restored', () => {
  beforeEach(() => {
    configurePendingRetention('session');
    useUiStore.getState().clearPendingSends();
  });
  afterEach(() => {
    configurePendingRetention('none');
    useUiStore.getState().clearPendingSends();
  });

  it('gives back the message of this session for this conversation, as it was kept', () => {
    const kept = record(credentialTag('token-a'));
    useUiStore.getState().setPendingSend(REF, kept);
    expect(restorePending(credentialTag('token-a'), REF, kept.startedAt + 1000)).toEqual(kept);
    expect(restorePending(credentialTag('token-a'), 'c0000000-0000-4000-8000-000000000002', kept.startedAt)).toBeNull();
  });

  it('gives back nothing, and drops it, for another credential', () => {
    useUiStore.getState().setPendingSend(REF, record(credentialTag('token-a')));
    expect(restorePending(credentialTag('token-b'), REF, 1_000_001)).toBeNull();
    expect(useUiStore.getState().pendingSends[REF]).toBeUndefined();
  });

  it('gives back nothing, and drops it, once it is older than the cap; a clock stepped back keeps it (the key rules decide then)', () => {
    const kept = record(credentialTag('token-a'));
    useUiStore.getState().setPendingSend(REF, kept);
    expect(restorePending(credentialTag('token-a'), REF, kept.startedAt - 60_000)).toEqual(kept);
    expect(restorePending(credentialTag('token-a'), REF, kept.startedAt + PENDING_CAP_MS - 1)).toEqual(kept);
    expect(restorePending(credentialTag('token-a'), REF, kept.startedAt + PENDING_CAP_MS)).toBeNull();
    expect(useUiStore.getState().pendingSends[REF]).toBeUndefined();
  });

  it('gives back nothing while the retention is off, whatever the store holds', () => {
    useUiStore.getState().setPendingSend(REF, record(credentialTag('token-a')));
    configurePendingRetention('none');
    expect(restorePending(credentialTag('token-a'), REF, 1_000_001)).toBeNull();
  });
});

describe('the credential tag', () => {
  it('is stable, differs between credentials, and does not contain the credential', () => {
    const token = 'Fake_credential_for_tests_0123456789abcdefg';
    expect(credentialTag(token)).toBe(credentialTag(token));
    expect(credentialTag(token)).not.toBe(credentialTag(`${token}x`));
    expect(credentialTag(token)).toMatch(/^[0-9a-f]{16}$/);
    expect(credentialTag(token)).not.toContain(token.slice(0, 6));
  });
});

describe('the sign-out boundary', () => {
  let session: ReturnType<typeof useSession> | undefined;
  const Probe = () => {
    session = useSession();
    return <Text>{session.session.status}</Text>;
  };
  const storage: SessionStorage = { read: async () => 'opaque-token', write: async () => undefined, clear: async () => undefined };
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

  it('forgets every kept message with the credential and the cache', async () => {
    useUiStore.getState().setPendingSend(REF, record(credentialTag('opaque-token')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    await render(
      <AppProviders queryClient={queryClient} sessionStorage={storage} deviceStorage={deviceStorage}>
        <Probe />
      </AppProviders>,
    );
    expect(await screen.findByText('signedIn')).toBeOnTheScreen();
    expect(Object.keys(useUiStore.getState().pendingSends)).toHaveLength(1);
    await act(() => session!.clearSession());
    expect(screen.getByText('signedOut')).toBeOnTheScreen();
    expect(useUiStore.getState().pendingSends).toEqual({});
  });
});
