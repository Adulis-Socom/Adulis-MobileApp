import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { useUiStore } from '../state/ui-store';

// The real route tree under src/app, booted through the real root layout and providers.
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// The first walk through the real tree transforms expo-router on a cold cache (always, in CI).
jest.setTimeout(60_000);

const devGlobal = globalThis as unknown as { __DEV__: boolean };

beforeEach(() => {
  jest.clearAllMocks();
  useUiStore.setState({ activeMode: null, themePreference: 'system' });
});

it('reaches every mode shell and switches between them without re-authenticating', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('opaque-token');
  const router = await renderRouter(APP_DIR);
  expect(await screen.findByText('Adulis mobile foundation')).toBeOnTheScreen();
  expect(screen.getByText('Session: signed in')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Open Buyer' }));
  expect(await screen.findByText('Buyer foundation ready')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/buyer');
  expect(useUiStore.getState().activeMode).toBe('buyer');
  expect(screen.getByText('Session: signed in')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Switch to Seller Companion' }));
  expect(await screen.findByText('Seller Companion foundation ready')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/seller');
  expect(useUiStore.getState().activeMode).toBe('seller');
  expect(screen.getByText('Session: signed in')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Switch to Courier' }));
  expect(await screen.findByText('Courier foundation ready')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/courier');
  expect(useUiStore.getState().activeMode).toBe('courier');
  expect(screen.getByText('Session: signed in')).toBeOnTheScreen();

  // One credential read at startup; no mode switch touched the session.
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Back to foundation' }));
  expect(await screen.findByText('Adulis mobile foundation')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/');
  expect(useUiStore.getState().activeMode).toBeNull(); // no shell on screen, no active mode
});

it('never renders a shell for a mode the account does not have', async () => {
  const dev = devGlobal.__DEV__;
  devGlobal.__DEV__ = false; // a release build: Buyer only until the backend supplies relationships
  try {
    const router = await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText('Adulis mobile foundation')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
    expect(screen.queryByText('Seller Companion foundation ready')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open Seller Companion' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open Buyer' })).toBeOnTheScreen();
    expect(useUiStore.getState().activeMode).toBeNull();
  } finally {
    devGlobal.__DEV__ = dev;
  }
});

it('never lets a leftover active mode open a mode the account does not have', async () => {
  const dev = devGlobal.__DEV__;
  devGlobal.__DEV__ = false;
  useUiStore.setState({ activeMode: 'seller' }); // e.g. left over from an earlier account
  try {
    const router = await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText('Adulis mobile foundation')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
    expect(screen.queryByText('Seller Companion foundation ready')).not.toBeOnTheScreen();
  } finally {
    devGlobal.__DEV__ = dev;
  }
});

it('switches the theme preference from the foundation root', async () => {
  await renderRouter(APP_DIR);

  await fireEvent.press(await screen.findByRole('radio', { name: 'Dark' }));
  expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked();
  expect(useUiStore.getState().themePreference).toBe('dark');
});
