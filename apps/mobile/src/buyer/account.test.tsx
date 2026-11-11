import { am, en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  type Recorded,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-011: the You tab (Account, Preferences, Security, Privacy) and Account deletion on the
 * real route tree. Numbers are the work order's section 13 matrix (1-23).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const PHONE = '+251911234567';
const DELETION_CODE = '654321';
const TICKET = '0d000000-0000-4000-8000-000000000001';
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let api: ReturnType<typeof installFakeApi>;
const signedIn = (token = GOOD_TOKEN) => resetSecureStore({ [TOKEN_KEY]: token });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};

const session = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  audience: 'MOBILE',
  first_seen_at: '2026-11-10T09:00:00.000Z',
  last_activity_at: '2026-11-12T08:30:00.000Z',
  approx_location: null,
  expires_at: '2026-12-10T09:00:00.000Z',
  device_platform: 'ANDROID',
  remembered_label: null,
  remembered_device_id: null,
  remembered: false,
  current: false,
  ...overrides,
});
const A_CURRENT = session('5e000000-0000-4000-8000-00000000000a', { current: true });
const A_CONSOLE = session('5e000000-0000-4000-8000-00000000000b', { audience: 'CONSOLE', device_platform: 'WEB', approx_location: 'Addis Ababa, ET' });
const B_CURRENT = session('5e000000-0000-4000-8000-00000000000c', { current: true, device_platform: 'IOS' });

const sessionsFor = (call: Recorded): Reply => {
  if (call.headers.Authorization === `Bearer ${GOOD_TOKEN}`) return { status: 200, body: { data: [A_CURRENT, A_CONSOLE] } };
  if (call.headers.Authorization === `Bearer ${OTHER_TOKEN}`) return { status: 200, body: { data: [B_CURRENT] } };
  return problem(401, 'SESSION_EXPIRED', 'auth');
};

const deletionCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/deletion/'));
const preview = (overrides: Record<string, unknown> = {}) => ({
  status: 200,
  body: {
    items: [],
    effects: [
      { code: 'IDENTITY_SCRUBBED', message_key: 'deletion.effect.identity_scrubbed' },
      { code: 'REVIEWS_ANONYMISED_NOT_DELETED', message_key: 'deletion.effect.reviews_anonymised_not_deleted' },
    ],
    ...overrides,
  },
});

function installDeletion(expiresInMs = 15 * 60 * 1000) {
  api.on('POST /v1/deletion/otp/request', () => ({ status: 202, body: {} }));
  api.on('POST /v1/deletion/otp/verify', (call) =>
    call.body?.code === DELETION_CODE
      ? { status: 200, body: { ticket: TICKET, expires_at: new Date(Date.now() + expiresInMs).toISOString(), scope: 'ACCOUNT_DELETION' } }
      : problem(401, 'OTP_INVALID', 'auth'),
  );
  api.on('GET /v1/deletion/preview', (call) =>
    call.headers.Authorization === `Ticket ${TICKET}` ? preview() : problem(401, 'SESSION_EXPIRED', 'auth'),
  );
  api.on('POST /v1/deletion/confirm', (call) =>
    call.headers.Authorization === `Ticket ${TICKET}` && call.body?.acknowledge === true
      ? { status: 200, body: { deleted: true } }
      : problem(401, 'SESSION_EXPIRED', 'auth'),
  );
}

/** From the signed-in You tab to the deletion preview: Delete Account, Continue, phone, code. */
async function reachPreview() {
  await renderRouter(APP_DIR, { initialUrl: '/account' });
  await fireEvent.press(await screen.findByRole('button', { name: en['buyer.you.delete'] }));
  await fireEvent.press(await screen.findByRole('button', { name: en['buyer.delete.continue'] }));
  await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
  await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), DELETION_CODE);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
}

async function typeAndConfirm(word: string = en['buyer.delete.confirm_word']) {
  await fireEvent.changeText(await screen.findByLabelText(en['buyer.delete.confirm_label']), word);
  await fireEvent.press(screen.getByRole('button', { name: en['buyer.delete.confirm_button'] }));
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on('GET /v1/auth/sessions', sessionsFor);
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 23: the Account controls never touch commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('the You tab', () => {
  it('1. a guest sees the sign-in prompt and the device preferences, and no Account control', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: en['buyer.you.appearance.dark'] })).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.you.sessions'])).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.you.delete'] })).toBeNull();
    expect(screen.queryByRole('button', { name: en['common.signOut'] })).toBeNull();
    expect(api.callsTo('GET /v1/auth/sessions')).toHaveLength(0);
  });

  it('2, 7. signed in: the Account section, the live sessions with the current one marked, and no fabricated field', async () => {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.signed_in'])).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.you.session.current'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.you.session.platform.android'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.you.session.surface.console'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.you.session.platform.web'])).toBeOnTheScreen();
    // A location only where the server recorded one: one line for the console session, none for this one.
    expect(screen.getAllByText(/^Approximate location: /)).toHaveLength(1);
    expect(screen.getByText('Approximate location: Addis Ababa, ET')).toBeOnTheScreen();
    // Public session ids are never shown, and nothing offers to revoke another session.
    expect(screen.queryByText(new RegExp(A_CONSOLE.id))).toBeNull();
    expect(screen.queryByRole('button', { name: /revoke/i })).toBeNull();
    expect(api.callsTo('GET /v1/auth/sessions')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(api.calls.filter((c) => c.method === 'DELETE' || c.path.includes('revoke'))).toEqual([]);
  });

  it('3, 4. Appearance: Dark and System apply and show which is selected', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('radio', { name: en['buyer.you.appearance.dark'] }));
    expect(useUiStore.getState().themePreference).toBe('dark');
    expect(screen.getByRole('radio', { name: en['buyer.you.appearance.dark'] })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.appearance.system'] }));
    expect(useUiStore.getState().themePreference).toBe('system');
    expect(screen.getByRole('radio', { name: en['buyer.you.appearance.system'] })).toBeChecked();
  });

  it('5. Language (development build): Amharic applies at once, and English comes back', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('radio', { name: en['buyer.you.language.am'] }));
    expect(await screen.findByText(am['buyer.you.preferences'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: am['buyer.you.language.en'] }));
    expect(await screen.findByText(en['buyer.you.preferences'])).toBeOnTheScreen();
  });

  it('6. a release build offers no Amharic and renders English whatever the store holds', async () => {
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    try {
      useUiStore.setState({ locale: 'am' });
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByText(en['buyer.you.language.english_only'])).toBeOnTheScreen();
      expect(screen.queryByRole('radio', { name: en['buyer.you.language.am'] })).toBeNull();
      expect(screen.queryByText(am['buyer.you.preferences'])).toBeNull();
    } finally {
      devGlobal.__DEV__ = dev;
    }
  });

  it('8. Refresh reads the sessions again and shows the new answer', async () => {
    signedIn();
    let answer: Reply = { status: 200, body: { data: [A_CURRENT] } };
    api.on('GET /v1/auth/sessions', () => answer);
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await screen.findByText(en['buyer.you.session.current']);
    expect(screen.queryByText(en['buyer.you.session.surface.console'])).toBeNull();
    answer = { status: 200, body: { data: [A_CURRENT, A_CONSOLE] } };
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.you.sessions.refresh'] }));
    expect(await screen.findByText(en['buyer.you.session.surface.console'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/auth/sessions')).toHaveLength(2);
  });

  it('21. a failed sessions read says so and Try again recovers', async () => {
    signedIn();
    let reply: Reply = 'offline';
    api.on('GET /v1/auth/sessions', () => reply);
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.sessions.failed'], {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    reply = { status: 200, body: { data: [A_CURRENT] } };
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.you.session.current'])).toBeOnTheScreen();
  });

  it('9. Sign out revokes this session on the server and returns the tab to the guest state', async () => {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(memory.has(TOKEN_KEY)).toBe(false);
    await waitFor(() => expect(api.callsTo('POST /v1/auth/logout')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`));
    expect(screen.queryByText(en['buyer.you.session.current'])).toBeNull();
  });

  it('10. a session the server ended (401 SESSION_EXPIRED) returns the tab to the guest state', async () => {
    resetSecureStore({ [TOKEN_KEY]: 'Expired_credential_for_tests_0123456789abc' });
    api.on('GET /v1/bootstrap', () => ({ status: 200, body: {} as never }));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(memory.has(TOKEN_KEY)).toBe(false);
  });

  it('12, 22. a sessions answer that lands after sign-out is never shown', async () => {
    signedIn();
    const { gate, release } = held();
    api.on('GET /v1/auth/sessions', async (call) => {
      await gate;
      return sessionsFor(call);
    });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    expect(screen.queryByText(en['buyer.you.session.current'])).toBeNull();
    expect(screen.queryByText(en['buyer.you.session.surface.console'])).toBeNull();
  });

  it('11, 22. another Account signing in on this device sees only its own sessions', async () => {
    signedIn();
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization === `Bearer ${OTHER_TOKEN}` || call.headers.Authorization === `Bearer ${GOOD_TOKEN}`
        ? { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) }
        : { status: 200, body: bootstrapBody() },
    );
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? { status: 200, body: { account_id: '0b6f1a3e-3333-4333-8333-333333333333', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: OTHER_TOKEN } }
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await screen.findByText(en['buyer.you.session.surface.console']);
    await fireEvent.press(screen.getByRole('button', { name: en['common.signOut'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911000002');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(await screen.findByText(en['buyer.you.session.platform.ios'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.you.session.surface.console'])).toBeNull();
    expect(bottomTab(en['buyer.tab.you'])).toBeOnTheScreen();
  });
});

describe('Delete Account', () => {
  it('13, 16. the code request and the preview are anonymous ticket calls: no bearer, ever', async () => {
    signedIn();
    installDeletion();
    await reachPreview();
    expect(await screen.findByText(en['deletion.effect.identity_scrubbed'])).toBeOnTheScreen();
    expect(screen.getByText(en['deletion.effect.reviews_anonymised_not_deleted'])).toBeOnTheScreen();
    const [request] = api.callsTo('POST /v1/deletion/otp/request');
    expect(request?.body).toEqual({ phone: PHONE });
    expect(request?.headers['Idempotency-Key']).toMatch(UUID7);
    expect(api.callsTo('GET /v1/deletion/preview')[0]?.headers.Authorization).toBe(`Ticket ${TICKET}`);
    for (const call of deletionCalls()) expect(call.headers.Authorization ?? '').not.toMatch(/^Bearer /);
    // The ticket is never written to the device.
    expect([...memory.values()].some((v) => v.includes(TICKET))).toBe(false);
  });

  it('14. a wrong code is refused with the server\'s message and mints no ticket', async () => {
    signedIn();
    installDeletion();
    await renderRouter(APP_DIR, { initialUrl: '/account/delete' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.delete.continue'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), '000000');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(await screen.findByText(en['error.auth.otp_invalid'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/deletion/preview')).toHaveLength(0);
  });

  it('15. an expired ticket (server 401) sends the Buyer back for a new code, and the session survives', async () => {
    signedIn();
    installDeletion();
    api.on('GET /v1/deletion/preview', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await reachPreview();
    expect(await screen.findByText(en['buyer.delete.ticket_expired'])).toBeOnTheScreen();
    expect(screen.getByLabelText(en['auth.phone.label'])).toBeOnTheScreen();
    // A ticket's 401 is not the session's: still signed in.
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
  });

  it('15. a ticket past its deadline is never sent', async () => {
    signedIn();
    installDeletion(-1000);
    await reachPreview();
    expect(await screen.findByText(en['buyer.delete.ticket_expired'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/deletion/preview')).toHaveLength(0);
  });

  it('17. blockers from the server withhold confirmation', async () => {
    signedIn();
    installDeletion();
    api.on('GET /v1/deletion/preview', () =>
      preview({ items: [{ code: 'OPEN_CLAIMS', message_key: 'deletion.blocker.open_claims', slots: { count: 1 }, resolving_action: { kind: 'RESOLVE_CLAIMS' } }] }),
    );
    await reachPreview();
    expect(await screen.findByText(en['buyer.delete.blocked_title'])).toBeOnTheScreen();
    expect(screen.getByText(en['deletion.blocker.open_claims'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.delete.confirm_button'] })).toBeNull();
  });

  it('21. a consequence the app cannot render withholds confirmation instead of hiding it', async () => {
    signedIn();
    installDeletion();
    api.on('GET /v1/deletion/preview', () => preview({ effects: [{ code: 'NEW_EFFECT', message_key: 'deletion.effect.something_new' }] }));
    await reachPreview();
    expect(await screen.findByText(en['buyer.delete.preview_incomplete'])).toBeOnTheScreen();
    expect(screen.queryByText('deletion.effect.something_new')).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.delete.confirm_button'] })).toBeNull();
  });

  it('18, 19. only the typed confirmation deletes; then the device forgets the session', async () => {
    signedIn();
    installDeletion();
    await reachPreview();
    await typeAndConfirm('delete me');
    expect(await screen.findByText('Type DELETE exactly to confirm.')).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/deletion/confirm')).toHaveLength(0);
    await typeAndConfirm();
    expect(await screen.findByText(en['buyer.delete.done'])).toBeOnTheScreen();
    const [confirm] = api.callsTo('POST /v1/deletion/confirm');
    expect(confirm?.headers.Authorization).toBe(`Ticket ${TICKET}`);
    expect(confirm?.headers['Idempotency-Key']).toMatch(UUID7);
    expect(confirm?.body).toEqual({ acknowledge: true });
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
  });

  it('19. local state is not cleared when the confirm fails', async () => {
    signedIn();
    installDeletion();
    api.on('POST /v1/deletion/confirm', () => problem(500, 'INTERNAL', 'request'));
    await reachPreview();
    await typeAndConfirm();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    expect(screen.queryByText(en['buyer.delete.done'])).toBeNull();
  });

  it('17. a 409 DELETION_BLOCKED at confirm shows the blockers it carries', async () => {
    signedIn();
    installDeletion();
    api.on('POST /v1/deletion/confirm', () => ({
      status: 409,
      body: {
        ...problem(409, 'DELETION_BLOCKED', 'deletion').body,
        items: [{ code: 'BUYER_ORDERS_IN_PAYMENT', message_key: 'deletion.blocker.buyer_orders_in_payment', slots: { count: 1 } }],
      },
    }));
    await reachPreview();
    await typeAndConfirm();
    expect(await screen.findByText(en['deletion.blocker.buyer_orders_in_payment'])).toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
  });

  it('21. a confirm lost offline is retried under the same key and replays', async () => {
    signedIn();
    installDeletion();
    let first = true;
    api.on('POST /v1/deletion/confirm', () => {
      if (first) {
        first = false;
        return 'offline';
      }
      return { status: 200, body: { deleted: true } };
    });
    await reachPreview();
    await typeAndConfirm();
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.delete.confirm_button'] }));
    expect(await screen.findByText(en['buyer.delete.done'])).toBeOnTheScreen();
    const keys = api.callsTo('POST /v1/deletion/confirm').map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('21. a lost answer followed by a refused ticket is reported as unconfirmed, never as either outcome', async () => {
    signedIn();
    installDeletion();
    let first = true;
    api.on('POST /v1/deletion/confirm', () => {
      if (first) {
        first = false;
        return 'offline';
      }
      return problem(401, 'SESSION_EXPIRED', 'auth');
    });
    await reachPreview();
    await typeAndConfirm();
    await screen.findByText(en['common.offline']);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.delete.confirm_button'] }));
    expect(await screen.findByText(en['buyer.delete.unconfirmed'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.delete.done'])).toBeNull();
  });

  it('20. Cancel leaves without any deletion call', async () => {
    signedIn();
    installDeletion();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.you.delete'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.delete.cancel'] }));
    expect(await screen.findByText(en['buyer.you.signed_in'])).toBeOnTheScreen();
    expect(deletionCalls()).toEqual([]);
  });

  it('a guest cannot open Delete Account', async () => {
    installDeletion();
    await renderRouter(APP_DIR, { initialUrl: '/account/delete' });
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.delete.continue'] })).toBeNull();
  });
});
