import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { AccessibilityInfo, Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  type Recorded,
} from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

// The real route tree, root layout and providers; the network is the fake API.
const APP_DIR = 'src/app';
const PHONE = '+251911234567';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REGISTRATION_KEY = 'adulis.device.registration_key';
const registered = (call: Recorded) => ({ status: 201, body: { id: call.body?.id } });
const keyOf = (call: Recorded | undefined) => call?.headers['Idempotency-Key'];
const verifyLink = (phone: string, returnTo?: string) => ({
  pathname: '/auth/verify',
  params: { phone, ...(returnTo ? { returnTo } : {}) },
});

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const tokenDeletes = () => jest.mocked(SecureStore.deleteItemAsync).mock.calls.filter(([key]) => key === TOKEN_KEY);
let api: ReturnType<typeof installFakeApi>;

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

/** From a guest Orders tab: Sign in, phone, Send code. Leaves the verify screen open. */
async function requestCode(phone = PHONE) {
  await renderRouter(APP_DIR, { initialUrl: '/orders' });
  await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
  await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), phone);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
  await screen.findByLabelText(en['auth.code.label']);
}

async function enterCode(code = SIGN_IN_CODE) {
  await fireEvent.changeText(screen.getByLabelText(en['auth.code.label']), code);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
}

describe('first launch', () => {
  it('registers the install, keyed by a new persistent device id, before bootstrap', async () => {
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    const [register] = api.callsTo('POST /v1/devices');
    const deviceId = memory.get('adulis.device.id');
    expect(deviceId).toMatch(UUID);
    expect(register?.body).toEqual({ id: deviceId, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' });
    // Identity is not a retry key: the registration intent has its own UUIDv7.
    expect(register?.headers['Idempotency-Key']).toMatch(UUID7);
    expect(register?.headers['Idempotency-Key']).not.toBe(deviceId);
    expect(api.calls.map((c) => `${c.method} ${c.path}`).slice(0, 2)).toEqual(['POST /v1/devices', 'GET /v1/bootstrap']);
    const [boot] = api.callsTo('GET /v1/bootstrap');
    expect(boot?.headers['X-Adulis-Device']).toBe(deviceId);
    expect(boot?.headers['X-Adulis-Client']).toMatch(/^(ios|android)\/\d+\.\d+\.\d+$/);
    expect(boot?.headers.Authorization).toBeUndefined();
    expect(memory.get('adulis.device.registered')).toBe(deviceId);
    expect(memory.has(REGISTRATION_KEY)).toBe(false); // the intent is complete
  });

  it('on a later launch keeps the same device id and does not register again', async () => {
    const earlier = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    resetSecureStore({ 'adulis.device.id': earlier, 'adulis.device.registered': earlier });
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    expect(api.callsTo('POST /v1/devices')).toHaveLength(0);
    expect(api.callsTo('GET /v1/bootstrap')[0]?.headers['X-Adulis-Device']).toBe(earlier);
    expect(memory.get('adulis.device.id')).toBe(earlier);
  });
});

describe('device registration idempotency', () => {
  it('saves the key before the first attempt and retries a lost answer under it', async () => {
    const storedWhenSent: (string | undefined)[] = [];
    api.on('POST /v1/devices', () => {
      storedWhenSent.push(memory.get(REGISTRATION_KEY));
      return 'offline';
    });
    await renderRouter(APP_DIR);
    await waitFor(() => expect(api.callsTo('POST /v1/devices').length).toBeGreaterThanOrEqual(2), { timeout: 5_000 });
    // Already saved when the first request left: a crash mid-request still finds it.
    expect(storedWhenSent[0]).toBe(keyOf(api.callsTo('POST /v1/devices')[0]));
    const pending = memory.get(REGISTRATION_KEY);
    expect(pending).toMatch(UUID7);
    expect(pending).not.toBe(memory.get('adulis.device.id'));
    expect(new Set(api.callsTo('POST /v1/devices').map(keyOf))).toEqual(new Set([pending]));
    expect(memory.has('adulis.device.registered')).toBe(false);
  });

  it('a relaunch before confirmation reuses the saved key, then completes the intent', async () => {
    // What the launch above leaves behind: the install id and an unconfirmed intent.
    const deviceId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const pending = '019a6b2e-5f3c-7a1b-8c2d-3e4f5a6b7c8d';
    resetSecureStore({ 'adulis.device.id': deviceId, [REGISTRATION_KEY]: pending });
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    const [register] = api.callsTo('POST /v1/devices');
    expect(keyOf(register)).toBe(pending);
    expect(register?.body?.id).toBe(deviceId); // the device id never changed
    expect(memory.get('adulis.device.id')).toBe(deviceId);
    expect(memory.get('adulis.device.registered')).toBe(deviceId);
    expect(memory.has(REGISTRATION_KEY)).toBe(false);
  });

  it('a refused registration ends the intent: the next attempt has a new key, and OTP keys are their own', async () => {
    let attempts = 0;
    api.on('POST /v1/devices', (call) =>
      ++attempts === 1 ? problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 5 }) : registered(call),
    );
    await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in' });
    await waitFor(() => expect(api.callsTo('POST /v1/devices')).toHaveLength(1));
    await waitFor(() => expect(memory.has(REGISTRATION_KEY)).toBe(false));

    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await screen.findByLabelText(en['auth.code.label']);
    const [refused, accepted] = api.callsTo('POST /v1/devices').map(keyOf);
    expect(accepted).toMatch(UUID7);
    expect(accepted).not.toBe(refused);
    const otpKey = keyOf(api.callsTo('POST /v1/auth/otp/request')[0]);
    expect(otpKey).toMatch(UUID7);
    expect([refused, accepted]).not.toContain(otpKey);
  });

  it('a later registration (its record lost) is a new intent with a new key for the same device', async () => {
    await requestCode(); // the first launch registered, and that intent completed
    const deviceId = memory.get('adulis.device.id');
    memory.delete('adulis.device.registered');
    await enterCode(); // the signed-in bootstrap checks registration again
    await waitFor(() => expect(api.callsTo('POST /v1/devices')).toHaveLength(2));
    const [earlier, later] = api.callsTo('POST /v1/devices');
    expect(keyOf(later)).toMatch(UUID7);
    expect(keyOf(later)).not.toBe(keyOf(earlier));
    expect(later?.body?.id).toBe(deviceId);
    await waitFor(() => expect(memory.has(REGISTRATION_KEY)).toBe(false));
  });
});

describe('sign in', () => {
  it('starts only when the Buyer chooses Sign in, and validates the phone first', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/orders' });
    await screen.findByText(en['buyer.orders.signed_out']);
    expect(api.callsTo('POST /v1/auth/otp/request')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '0911 234 567');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    expect(await screen.findByText(en['auth.phone.invalid'])).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/auth/otp/request')).toHaveLength(0);
  });

  it('requests a code with the typed body and headers, then opens code entry', async () => {
    await requestCode('+251 911 234 567');
    const [req] = api.callsTo('POST /v1/auth/otp/request');
    expect(req?.body).toEqual({ phone: PHONE, purpose: 'SIGN_IN', audience: 'MOBILE' });
    expect(req?.headers['Idempotency-Key']).toMatch(UUID7);
    expect(req?.headers['X-Adulis-Device']).toBe(memory.get('adulis.device.id'));
    expect(req?.headers.Authorization).toBeUndefined();
    expect(screen.getByText(`We sent a six-digit code by SMS to ${PHONE}.`)).toBeOnTheScreen();
  });

  it('retries the same intent with the same idempotency key after a connection failure', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in' });
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    api.on('POST /v1/auth/otp/request', () => 'offline');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();

    api.on('POST /v1/auth/otp/request', () => ({ status: 202, body: {} }));
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await screen.findByLabelText(en['auth.code.label']);
    const keys = api.callsTo('POST /v1/auth/otp/request').map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('shows and speaks the server message for a refused request; trying again is a new request', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    api.on('POST /v1/auth/otp/request', () => problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 42 }));
    await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in' });
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    const message = 'Too many requests. Try again in 42 seconds.';
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(message);

    // The server answered, so nothing is pending: a stored refusal must not be replayed.
    api.on('POST /v1/auth/otp/request', () => ({ status: 202, body: {} }));
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await screen.findByLabelText(en['auth.code.label']);
    const keys = api.callsTo('POST /v1/auth/otp/request').map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('bootstraps before requesting a code when no bootstrap has succeeded yet', async () => {
    // Registration works, bootstrap fails at startup: the server has not placed the device.
    api.on('GET /v1/bootstrap', () => problem(503, 'INTERNAL', 'request'));
    await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in' });
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/auth/otp/request')).toHaveLength(0);

    api.on('GET /v1/bootstrap', () => ({ status: 200, body: bootstrapBody() }));
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await screen.findByLabelText(en['auth.code.label']);
    const order = api.calls.map((c) => `${c.method} ${c.path}`);
    expect(order.lastIndexOf('GET /v1/bootstrap')).toBeLessThan(order.indexOf('POST /v1/auth/otp/request'));
    expect(api.callsTo('POST /v1/devices')).toHaveLength(1);
  });

  it('refuses a wrong code with the catalogue message, spoken, and stores nothing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await requestCode();
    await enterCode('000000');
    expect(await screen.findByText(en['error.auth.otp_invalid'])).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(en['error.auth.otp_invalid']);
    expect(memory.has(TOKEN_KEY)).toBe(false);
    expect(memory.has('adulis.device.id')).toBe(true); // a failed sign-in is not a sign-out
  });

  it('signs in: the credential goes to SecureStore, the shell turns signed-in, and Orders comes back', async () => {
    await requestCode();
    await enterCode();

    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    const [verify] = api.callsTo('POST /v1/auth/otp/verify');
    expect(verify?.body).toEqual({ phone: PHONE, code: SIGN_IN_CODE, device_id: memory.get('adulis.device.id') });
    expect(verify?.headers['Idempotency-Key']).toMatch(UUID7);

    // The authenticated bootstrap follows at once, with the bearer: no restart needed.
    await waitFor(() => expect(api.callsTo('GET /v1/bootstrap').at(-1)?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`));
    await fireEvent.press(bottomTab(en['buyer.tab.saved']));
    expect(await screen.findByText(en['buyer.saved.private'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
  });

  it('asks a new Account for the over-18 declaration, and only then', async () => {
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.age_declared_over_18 === true
        ? { status: 200, body: { account_id: 'a', audience: 'MOBILE', roles: [], expires_at: 'x', token: GOOD_TOKEN } }
        : problem(400, 'AGE_DECLARATION_REQUIRED', 'auth', { path: 'age_declared_over_18' }),
    );
    await requestCode();
    expect(screen.queryByRole('checkbox')).not.toBeOnTheScreen(); // not asked up front
    await enterCode();
    expect(await screen.findByText(en['error.auth.age_declaration_required'])).toBeOnTheScreen();
    expect(screen.getByDisplayValue(SIGN_IN_CODE)).toBeOnTheScreen(); // the good code is kept, not marked wrong
    const declaration = screen.getByRole('checkbox', { name: en['auth.age.declaration'] });
    expect(declaration).not.toBeChecked();

    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(api.callsTo('POST /v1/auth/otp/verify')).toHaveLength(1); // unchecked: not sent

    await fireEvent.press(declaration);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
    const [, second] = api.callsTo('POST /v1/auth/otp/verify');
    expect(second?.body?.age_declared_over_18).toBe(true);
    expect(second?.body).not.toHaveProperty('date_of_birth');
  });

  it('resends a new code, and reports the server backoff in its own words', async () => {
    await requestCode();
    await fireEvent.press(screen.getByRole('button', { name: en['auth.resend'] }));
    expect(await screen.findByText(en['auth.code.resent'])).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/auth/otp/resend')[0]?.body).toEqual({ phone: PHONE, purpose: 'SIGN_IN', audience: 'MOBILE' });

    api.on('POST /v1/auth/otp/resend', () => problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 60 }));
    await fireEvent.press(screen.getByRole('button', { name: en['auth.resend'] }));
    expect(await screen.findByText('Too many requests. Try again in 60 seconds.')).toBeOnTheScreen();
  });

  it('goes back to change the number', async () => {
    await requestCode();
    await fireEvent.press(screen.getByRole('button', { name: en['auth.change_number'] }));
    expect(await screen.findByLabelText(en['auth.phone.label'])).toBeOnTheScreen();
  });
});

describe('verify needs a code this app run asked for', () => {
  const noCodeSent = () => {
    expect(api.callsTo('POST /v1/auth/otp/resend')).toHaveLength(0);
    expect(api.callsTo('POST /v1/auth/otp/request')).toHaveLength(0);
  };

  it('a cold link to Verify opens Sign in instead: no form, no resend, no SMS; a safe returnTo is kept', async () => {
    await renderRouter(APP_DIR, { initialUrl: `/auth/verify?phone=${encodeURIComponent(PHONE)}&returnTo=%2Fsaved` });
    expect(await screen.findByLabelText(en['auth.phone.label'])).toBeOnTheScreen();
    expect(screen).toHavePathname('/auth/sign-in');
    expect(screen).toHaveSearchParams({ returnTo: '/saved' });
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['auth.resend'] })).not.toBeOnTheScreen();
    noCodeSent();

    // The Buyer starts properly and still lands where the link pointed.
    await fireEvent.changeText(screen.getByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await screen.findByLabelText(en['auth.code.label']);
    await enterCode();
    expect(await screen.findByText(en['buyer.saved.private'])).toBeOnTheScreen();
  });

  it('an unsafe returnTo on a cold Verify link becomes You', async () => {
    await renderRouter(APP_DIR, {
      initialUrl: `/auth/verify?phone=${encodeURIComponent(PHONE)}&returnTo=${encodeURIComponent('https://evil.example')}`,
    });
    await screen.findByLabelText(en['auth.phone.label']);
    expect(screen).toHaveSearchParams({ returnTo: '/account' });
    noCodeSent();
  });

  it('a link for another number than the code was asked for opens Sign in, and sends nothing', async () => {
    await requestCode();
    await act(() => router.push(verifyLink('+251922000000')));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
    expect(api.callsTo('POST /v1/auth/otp/resend')).toHaveLength(0);
    expect(api.callsTo('POST /v1/auth/otp/request')).toHaveLength(1);
  });

  it('a successful resend keeps Verify usable', async () => {
    await requestCode();
    await fireEvent.press(screen.getByRole('button', { name: en['auth.resend'] }));
    expect(await screen.findByText(en['auth.code.resent'])).toBeOnTheScreen();
    await enterCode();
    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
  });

  it('Change number ends the code flow: Verify for the old number no longer opens', async () => {
    await requestCode();
    await fireEvent.press(screen.getByRole('button', { name: en['auth.change_number'] }));
    await screen.findByLabelText(en['auth.phone.label']);
    await act(() => router.push(verifyLink(PHONE)));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
  });

  it('Back ends the code flow too', async () => {
    await requestCode();
    await act(() => router.back());
    await screen.findByLabelText(en['auth.phone.label']);
    await act(() => router.push(verifyLink(PHONE)));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
  });

  it.each([
    ['a tab link', () => router.navigate('/saved')],
    ['dismissing the stack', () => router.dismissAll()],
  ])('leaving Verify without Sign in (%s) ends the code flow too', async (_how, leave) => {
    await requestCode();
    await act(() => leave());
    await waitFor(() => expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen());
    await act(() => router.push(verifyLink(PHONE)));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
    expect(api.callsTo('POST /v1/auth/otp/resend')).toHaveLength(0);
  });

  it('a finished sign-in ends the code flow', async () => {
    await requestCode();
    await enterCode();
    await screen.findByText(en['buyer.orders.coming']);
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(() => router.push(verifyLink(PHONE)));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen.queryByLabelText(en['auth.code.label'])).not.toBeOnTheScreen();
  });

  it('the code flow is memory only: nothing stored names the phone, so a new run starts without it', async () => {
    // A new run is a fresh render (the cold-link test above); all it inherits is storage.
    await requestCode();
    await fireEvent.press(screen.getByRole('button', { name: en['auth.resend'] }));
    await screen.findByText(en['auth.code.resent']);
    const written = jest.mocked(SecureStore.setItemAsync).mock.calls.map(([key]) => key);
    expect(new Set(written)).toEqual(new Set(['adulis.device.id', REGISTRATION_KEY, 'adulis.device.registered']));
    expect([...memory.values()].join('|')).not.toContain(PHONE);
  });
});

describe('session lifecycle', () => {
  it('restores a stored session on restart, proven live by the authenticated bootstrap', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    await renderRouter(APP_DIR, { initialUrl: '/orders' });
    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/bootstrap')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });

  it.each(['SESSION_EXPIRED', 'SESSION_REVOKED'] as const)(
    'a %s credential is removed once and the Buyer continues as a guest',
    async (code) => {
      resetSecureStore({ [TOKEN_KEY]: 'Dead_credential_for_tests_0123456789abcdefg' });
      api.on('GET /v1/bootstrap', (call) =>
        call.headers.Authorization ? problem(401, code, 'auth') : { status: 200, body: bootstrapBody() },
      );
      await renderRouter(APP_DIR, { initialUrl: '/orders' });
      expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
      expect(memory.has(TOKEN_KEY)).toBe(false);
      expect(tokenDeletes()).toHaveLength(1);
      // Not retried with the dead credential; the guest bootstrap carries none.
      const withBearer = api.callsTo('GET /v1/bootstrap').filter((c) => c.headers.Authorization);
      expect(withBearer).toHaveLength(1);
      await waitFor(() => expect(api.callsTo('GET /v1/bootstrap').at(-1)?.headers.Authorization).toBeUndefined());
    },
  );

  it('leaves an ended session even when the device cannot delete the credential', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    resetSecureStore({ [TOKEN_KEY]: 'Dead_credential_for_tests_0123456789abcdefg' });
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization ? problem(401, 'SESSION_REVOKED', 'auth') : { status: 200, body: bootstrapBody() },
    );
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('keystore unavailable'));
    try {
      await renderRouter(APP_DIR, { initialUrl: '/orders' });
      expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
      await waitFor(() => expect(api.callsTo('GET /v1/bootstrap').at(-1)?.headers.Authorization).toBeUndefined());
      expect(api.callsTo('GET /v1/bootstrap').filter((c) => c.headers.Authorization)).toHaveLength(1);
      expect(JSON.stringify(warn.mock.calls)).toContain('keystore unavailable');
    } finally {
      warn.mockRestore();
    }
  });

  it('offline at startup keeps the stored session: offline is not signed out', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on('GET /v1/bootstrap', () => 'offline');
    await renderRouter(APP_DIR, { initialUrl: '/orders' });
    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    expect(tokenDeletes()).toHaveLength(0);
  });

  it('a 401 that is not about the session (a wrong code) clears nothing', async () => {
    resetSecureStore();
    await requestCode();
    await enterCode('999999');
    await screen.findByText(en['error.auth.otp_invalid']);
    expect(tokenDeletes()).toHaveLength(0);
  });

  it('signs out: the credential leaves the device, the server is told, the shell is guest again', async () => {
    await requestCode();
    await enterCode();
    await screen.findByText(en['buyer.orders.coming']);
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(memory.has(TOKEN_KEY)).toBe(false);
    expect(api.callsTo('POST /v1/auth/logout')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
  });
});

describe('client version', () => {
  it('UPGRADE_REQUIRED blocks the whole app, deep links included, until the server says otherwise', async () => {
    api.on('GET /v1/bootstrap', () => ({ status: 200, body: bootstrapBody({ client_status: 'UPGRADE_REQUIRED' }) }));
    await renderRouter(APP_DIR, { initialUrl: '/orders' });
    expect(await screen.findByText(en['app.upgrade.required.body'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.orders.signed_out'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['auth.sign_in'] })).not.toBeOnTheScreen();

    api.on('GET /v1/bootstrap', () => ({ status: 200, body: bootstrapBody() }));
    await fireEvent.press(screen.getByRole('button', { name: en['app.upgrade.check_again'] }));
    expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
  });

  it('UPGRADE_RECOMMENDED shows a dismissible notice and blocks nothing', async () => {
    api.on('GET /v1/bootstrap', () => ({ status: 200, body: bootstrapBody({ client_status: 'UPGRADE_RECOMMENDED' }) }));
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['app.upgrade.recommended'])).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['app.upgrade.dismiss'] }));
    expect(screen.queryByText(en['app.upgrade.recommended'])).not.toBeOnTheScreen();
  });
});

describe('account_context and release builds', () => {
  it('has no account_context for a guest', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/dev' });
    expect(await screen.findByText('account_context: none')).toBeOnTheScreen();
  });

  it('holds the server account_context exactly as sent for a signed-in Buyer', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on('GET /v1/bootstrap', () => ({
      status: 200,
      body: bootstrapBody({
        account_context: { buyer: { available: true }, seller_companion: { available: true }, courier: { available: false } },
      }),
    }));
    await renderRouter(APP_DIR, { initialUrl: '/dev' });
    expect(await screen.findByText('account_context: seller_companion available, courier unavailable')).toBeOnTheScreen();
  });

  // WO-020 replaces WO-003's "release builds stay Buyer-only whatever account_context says": Seller
  // mode is now the server's to grant, in release builds too. Courier and diagnostics stay out.
  it('a release build offers Seller mode exactly when the server says so, and never Courier or diagnostics', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on('GET /v1/bootstrap', () => ({
      status: 200,
      body: bootstrapBody({
        account_context: { buyer: { available: true }, seller_companion: { available: true }, courier: { available: false } },
      }),
    }));
    api.on('GET /v1/seller/list', () => ({
      status: 200,
      body: { data: [{ id: 'aaaaaaaa-0000-4000-8000-00000000000a', handle: 'store-a', store_name: 'Store A', status: 'ACTIVE', role: 'OWNER' }] },
    }));
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    try {
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      expect(screen.queryByText(/Courier|Developer diagnostics/)).not.toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: en['seller.mode.switch_to_seller'] }));
      expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
      await act(() => router.push('/courier'));
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    } finally {
      devGlobal.__DEV__ = dev;
    }
  });
});

describe('security', () => {
  it('never logs or stores the credential or the code anywhere but SecureStore', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    try {
      await requestCode();
      await enterCode();
      await screen.findByText(en['buyer.orders.coming']);
      await fireEvent.press(bottomTab(en['buyer.tab.you']));
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      await screen.findByText(en['buyer.you.signed_out']);

      const logged = JSON.stringify(spies.map((s) => s.mock.calls));
      expect(logged).not.toContain(GOOD_TOKEN);
      expect(logged).not.toContain(SIGN_IN_CODE);
      // UI state never held it.
      expect(JSON.stringify(useUiStore.getState())).not.toContain(GOOD_TOKEN);
      // The only SecureStore writes of the credential went under its own key.
      const writes = jest.mocked(SecureStore.setItemAsync).mock.calls.filter(([, value]) => value === GOOD_TOKEN);
      expect(writes).toEqual([[TOKEN_KEY, GOOD_TOKEN]]);
      // Every bearer ever sent is the issued credential: never an account id or a public id.
      const bearers = api.calls.map((c: Recorded) => c.headers.Authorization).filter(Boolean);
      expect(new Set(bearers)).toEqual(new Set([`Bearer ${GOOD_TOKEN}`]));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('never shows the code back on screen', async () => {
    await requestCode();
    await enterCode('654321');
    await screen.findByText(en['error.auth.otp_invalid']);
    expect(screen.queryByText(/654321/)).not.toBeOnTheScreen();
  });
});
