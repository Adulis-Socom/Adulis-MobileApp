import { en } from '@adulis/locale/mobile';
import { renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { installFakeApi } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * The static scan in accessible-names.test.ts reads the sources; this draws the screens a Buyer sees
 * first and asks the way a screen reader does: every control with a button, tab, link, checkbox or
 * radio role has a non-empty accessible name (its label, or the words inside it).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const ROLES = ['button', 'tab', 'link', 'checkbox', 'radio'] as const;

function expectEveryControlNamed() {
  let controls = 0;
  for (const role of ROLES) {
    const all = screen.queryAllByRole(role);
    const named = screen.queryAllByRole(role, { name: /\S/ });
    controls += all.length;
    expect({ role, unnamed: all.length - named.length }).toEqual({ role, unnamed: 0 });
  }
  expect(controls).toBeGreaterThan(5);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('every control on the first screens has an accessible name', () => {
  it('Home: the search and notification buttons, the channels and the five bottom tabs', async () => {
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expectEveryControlNamed();
  });

  it('You, as a guest: the sign-in button, the appearance and language choices', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expectEveryControlNamed();
  });
});
