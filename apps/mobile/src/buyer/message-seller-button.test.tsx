import { en } from '@adulis/locale/mobile';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useSession } from '../auth/session';
import type { SessionStorage } from '../auth/session-storage';
import type { DeviceStorage } from '../device/device-storage';
import { AppProviders } from '../providers/AppProviders';
import { GOOD_TOKEN, installFakeApi, type Reply } from '../testing/fake-api';
import { MessageSellerButton } from './MessageSellerButton';

jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => ({ push: jest.fn() }) }));

/**
 * The button keeps one idempotency key for an open that was not answered. It sits on screens that stay
 * mounted when the Account changes, so the key must not travel to the next Account: it is a key of the
 * credential that minted it. The button is rendered on its own here, under the real session, because on the
 * Seller Profile and Product screens the profile's data is dropped at sign-out and the button is unmounted
 * by that, which would hide whether the button itself lets go of the key.
 */
const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const SELLER = '0b6f1a3e-2222-4222-8222-222222222222';

const sessionStorage = (token: string): SessionStorage => ({
  read: async () => token,
  write: async () => undefined,
  clear: async () => undefined,
});
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

let session: ReturnType<typeof useSession> | undefined;
function Probe() {
  session = useSession();
  return <Text>{session.session.status}</Text>;
}

describe('Message Seller across an Account change', () => {
  beforeEach(() => entries.clear());

  async function boot(firstReply: Reply = 'offline') {
    const fake = installFakeApi();
    // Never answered: the outcome of the open stays unknown, so its key is kept for the retry.
    fake.on('POST /v1/conversations', () => firstReply);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    await render(
      <AppProviders queryClient={queryClient} sessionStorage={sessionStorage(GOOD_TOKEN)} deviceStorage={deviceStorage}>
        <Probe />
        <MessageSellerButton sellerId={SELLER} />
      </AppProviders>,
    );
    expect(await screen.findByText('signedIn')).toBeOnTheScreen();
    const opens = () => fake.calls.filter((c) => c.method === 'POST' && c.path === '/v1/conversations');
    const press = () => fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.message_seller'] }));
    return { opens, press };
  }

  it('keeps the key for the same Account: a second tap after a lost answer is the same request', async () => {
    const { opens, press } = await boot();
    await press();
    await waitFor(() => expect(opens()).toHaveLength(1));
    await press();
    await waitFor(() => expect(opens()).toHaveLength(2));
    expect(opens()[1]!.headers['Idempotency-Key']).toBe(opens()[0]!.headers['Idempotency-Key']);
  });

  it('BUY-27B: a 201 whose answer cannot be read is unknown: a second tap is the same request, same key', async () => {
    const { opens, press } = await boot({ status: 201, unreadable: true });
    await press();
    await waitFor(() => expect(opens()).toHaveLength(1));
    await press();
    await waitFor(() => expect(opens()).toHaveLength(2));
    expect(opens()[1]!.headers['Idempotency-Key']).toBe(opens()[0]!.headers['Idempotency-Key']);
  });

  it("does not use the first Account's key for the second Account", async () => {
    const { opens, press } = await boot();
    await press();
    await waitFor(() => expect(opens()).toHaveLength(1));
    await act(() => session!.signIn(OTHER_TOKEN));
    await press();
    await waitFor(() => expect(opens()).toHaveLength(2));
    expect(opens()[0]!.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(opens()[1]!.headers.Authorization).toBe(`Bearer ${OTHER_TOKEN}`);
    expect(opens()[1]!.headers['Idempotency-Key']).not.toBe(opens()[0]!.headers['Idempotency-Key']);
  });
});
