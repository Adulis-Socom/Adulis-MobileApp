import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { GOOD_TOKEN, type installFakeApi } from '../testing/fake-api';
import type { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';
import { installSavedApp } from '../testing/saved-app';

/**
 * The Add to collection picker lists every Collection the server holds, however the Saved tab (still mounted
 * after its first visit) last read them: a Collection made on another device, or in the picker itself, is
 * there to tick and to untick the next time the picker opens (WO-009 S15).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const PRODUCT = '/product/seller-1/basket';
let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const box = (name: string) => screen.findByRole('checkbox', { name });
const savedRows = (name: string) => screen.queryAllByRole('button', { name: new RegExp(`^${name}, `) });

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  ({ api, fc } = installSavedApp());
});

afterEach(() => {
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

async function openSavedThenProduct() {
  signedIn();
  await renderRouter(APP_DIR, { initialUrl: '/saved' });
  await waitFor(() => expect(savedRows('Saved')).toHaveLength(1));
  await act(() => router.push(PRODUCT));
}

const openPicker = async () => fireEvent.press(await screen.findByRole('button', { name: en['buyer.save.add'] }));

describe('the picker after the Saved tab was opened', () => {
  it('lists a Collection that was made elsewhere since the Saved tab last read, and it can be ticked', async () => {
    await openSavedThenProduct();
    fc.named('Gifts');
    await openPicker();
    await waitFor(() => expect(screen).toHavePathname('/save-to'));
    expect(await box('Saved')).not.toBeChecked();
    await fireEvent.press(await box('Gifts'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Gifts' })).toBeChecked());
    expect(fc.items).toHaveLength(1);
  });

  it('lists a Collection made in the picker when it opens again, and the tick can be removed', async () => {
    await openSavedThenProduct();
    await openPicker();
    await waitFor(() => expect(screen).toHavePathname('/save-to'));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.saved.name']), 'Gifts');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Gifts' })).toBeChecked());
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.done'] }));
    await waitFor(() => expect(screen).toHavePathname(PRODUCT));

    await openPicker();
    await waitFor(() => expect(screen).toHavePathname('/save-to'));
    expect(await box('Gifts')).toBeChecked();
    await fireEvent.press(await box('Gifts'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Gifts' })).not.toBeChecked());
    expect(fc.items).toEqual([]);
  });

  it('a Collection made in the picker is on the Saved tab when the Buyer returns to it', async () => {
    await openSavedThenProduct();
    await openPicker();
    await waitFor(() => expect(screen).toHavePathname('/save-to'));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.saved.name']), 'Gifts');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Gifts' })).toBeChecked());
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.done'] }));
    await waitFor(() => expect(screen).toHavePathname(PRODUCT));
    await act(() => router.back());
    await waitFor(() => expect(screen).toHavePathname('/saved'));
    await waitFor(() => expect(savedRows('Gifts')).toHaveLength(1));
  });
});
