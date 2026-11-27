// M01-R10: MOB-FE-01 behaviour through MOUNTED routes: the real src/app tree, root layout, providers and gate, booted by
// expo-router's renderRouter. Fixture mode unless a case says otherwise (the live transport fails closed: nothing to sign in to).
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { FIXTURE_BANNER, fixtureHandle, PERSONAS } from '../fixtures';
import { t } from '../i18n/messages';
import { resetSecureStore } from '../testing/secure-store-mock';
import { boot, bottomTab, button, findAllText, findText, fixturesOn, signInThroughScreens, WAIT } from '../testing/routes';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
// The first walk through the real tree transforms expo-router on a cold cache (always, in CI).
jest.setTimeout(90_000);

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;

beforeEach(() => {
  fixtureHandle.reset();
  resetSecureStore();
  fixturesOn(true);
});
afterAll(() => fixturesOn(false));

describe('initialization and guest Buyer', () => {
  it('boots as a guest onto Home, with the five Buyer tabs and the demonstration banner', async () => {
    const r = await boot();
    expect((await findAllText('mobile.home.title')).length).toBeGreaterThan(0);
    expect(r.getPathname()).toBe('/home');
    for (const name of ['mobile.tab.home', 'mobile.tab.shop', 'mobile.tab.saved', 'mobile.tab.orders', 'mobile.tab.account'] as const) expect(bottomTab(t(name))).toBeTruthy();
    expect(screen.getByText(FIXTURE_BANNER)).toBeTruthy();
    expect(screen.queryByText(/Seller Companion|Courier/)).toBeNull();
  });

  it('a guest on Saved sees the sign-in panel and nothing private', async () => {
    await boot();
    await findAllText('mobile.home.title');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
    expect(button('mobile.auth.sign_in')).toBeTruthy();
  });

  // Archived deep-link-reliability parity (ISS-039): two taps before the first navigation settles push one screen.
  it('a double tap on Sign in opens one Sign in screen, and Back returns to the prompt', async () => {
    await boot();
    await findAllText('mobile.home.title');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    await findText('error.auth.authentication_required');
    const signIn = button('mobile.auth.sign_in');
    await fireEvent.press(signIn);
    await fireEvent.press(signIn);
    await screen.findByLabelText(t('mobile.auth.phone.label'), undefined, WAIT);
    expect(screen.queryAllByLabelText(t('mobile.auth.phone.label'), { includeHiddenElements: true })).toHaveLength(1);
    await act(() => router.back());
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
  });
});

describe('sign-in, verification and return', () => {
  it('reopening Sign in while its code step is already open starts a new attempt: an empty code field, and the return to Saved is kept (M02-R02)', async () => {
    const r = await boot();
    await findAllText('mobile.home.title');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    await findText('error.auth.authentication_required');
    await fireEvent.press(button('mobile.auth.sign_in'));
    const field = await screen.findByLabelText(t('mobile.auth.phone.label'), undefined, WAIT);
    await fireEvent.changeText(field, phone('owner'));
    await fireEvent.press(button('mobile.auth.send_code'));
    const firstCode = await screen.findByLabelText(t('mobile.auth.code.label'), undefined, WAIT);
    await fireEvent.changeText(firstCode, '111111'); // typed, never submitted
    // The same destination is opened again while the code step is one screen down the stack (a link, or a second control).
    await act(() => router.push('/auth/sign-in?returnTo=%2Fsaved'));
    const again = await screen.findByLabelText(t('mobile.auth.phone.label'), undefined, WAIT);
    await fireEvent.changeText(again, phone('owner'));
    await fireEvent.press(button('mobile.auth.send_code'));
    const secondCode = await screen.findByLabelText(t('mobile.auth.code.label'), undefined, WAIT);
    expect(secondCode.props.value).toBe(''); // never the previous attempt's text
    await fireEvent.changeText(secondCode, '246810');
    await fireEvent.press(button('mobile.auth.verify'));
    expect(await findText('mobile.saved.empty')).toBeTruthy();
    expect(r.getPathname()).toBe('/saved');
  });

  it('signs in from the Saved prompt and returns to Saved, signed in', async () => {
    const r = await boot();
    await findAllText('mobile.home.title');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    await findText('error.auth.authentication_required');
    await fireEvent.press(button('mobile.auth.sign_in'));
    await signInThroughScreens(phone('owner'));
    expect(await findText('mobile.state.later')).toBeTruthy();
    expect(r.getPathname()).toBe('/saved');
    expect(screen.queryByText(t('error.auth.authentication_required'))).toBeNull();
  });

  it('a wrong code says the code is wrong; an Operator identifier gets exactly the same sentence and is not signed in', async () => {
    await boot('/auth/sign-in');
    await signInThroughScreens(phone('owner'), '000000');
    expect(await findText('mobile.auth.refused.otp_invalid')).toBeTruthy();

    await act(() => router.replace('/auth/sign-in'));
    await signInThroughScreens(phone('operator'));
    expect(await findText('mobile.auth.refused.otp_invalid')).toBeTruthy();
    expect(screen.getByLabelText(t('mobile.auth.code.label'))).toBeTruthy(); // still on Verify: nothing signed in
  });

  it('a link that names a mode root as the return destination lands on You instead, signed in', async () => {
    const r = await boot('/auth/sign-in?returnTo=%2Fcompanion');
    await signInThroughScreens(phone('owner'));
    expect(await findText('mobile.account.signed_in')).toBeTruthy();
    expect(r.getPathname()).toBe('/account');
    expect(screen.queryByText(t('mobile.companion.later'))).toBeNull();
  });

  it('verify opened by a link alone (no challenge from this run) goes back to sign-in', async () => {
    await boot('/auth/verify');
    expect(await screen.findByLabelText(t('mobile.auth.phone.label'), undefined, WAIT)).toBeTruthy();
  });
});

describe('session expiry and account switching', () => {
  it('a session the server ends right after sign-in returns to guest with one notice', async () => {
    await boot('/auth/sign-in');
    await signInThroughScreens(phone('expired'));
    expect(await findText('mobile.session.ended.expired')).toBeTruthy();
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
  });

  it('switching Account from You shows the second Account its own modes and none of the first', async () => {
    await boot();
    await findAllText('mobile.home.title');
    await fireEvent.press(bottomTab(t('mobile.tab.account')));
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.auth.sign_in') }, WAIT));
    await signInThroughScreens(phone('owner'));
    await act(() => router.push('/account'));
    expect(await screen.findByRole('button', { name: t('mobile.mode.switch_to', { mode: t('mobile.mode.seller_companion') }) }, WAIT)).toBeTruthy();

    await fireEvent.press(button('mobile.account.switch'));
    await signInThroughScreens(phone('second'));
    await act(() => router.push('/account'));
    // The second Account has a pending Courier invitation and no Seller relationship.
    expect(await findText('mobile.mode.pending')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.mode.switch_to', { mode: t('mobile.mode.seller_companion') }) })).toBeNull();
  });
});

describe('modes: eligibility, denial and revoked relationships', () => {
  it('a guest following a Companion link is asked to sign in and sees nothing of the mode', async () => {
    await boot('/companion');
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
    expect(screen.queryByText(t('mobile.companion.later'))).toBeNull();
  });

  it('an eligible Account enters Seller Companion without signing in again, and leaves it for Buyer', async () => {
    const r = await boot('/auth/sign-in');
    await signInThroughScreens(phone('owner'));
    await findAllText('mobile.home.title');
    await act(() => router.push('/companion'));
    expect(await findText('mobile.companion.later')).toBeTruthy();
    expect(screen.queryByLabelText(t('mobile.auth.phone.label'))).toBeNull();
    await fireEvent.press(button('mobile.mode.back_to_buyer'));
    expect((await findAllText('mobile.home.title')).length).toBeGreaterThan(0);
    expect(r.getPathname()).toBe('/home');
  });

  it('a revoked Seller relationship has no entry on You and a Companion link shows one neutral screen', async () => {
    await boot('/auth/sign-in');
    await signInThroughScreens(phone('revoked'));
    await findAllText('mobile.home.title');
    await act(() => router.push('/companion'));
    expect(await findText('mobile.state.unauthorized')).toBeTruthy();
    expect(screen.queryByText(t('mobile.companion.later'))).toBeNull();
    await act(() => router.push('/account'));
    expect(await findText('mobile.account.signed_in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.mode.switch_to', { mode: t('mobile.mode.seller_companion') }) })).toBeNull();
  });

  it('a pending Courier invitation is shown with the server sentence and a Courier link is not entered', async () => {
    await boot('/auth/sign-in');
    await signInThroughScreens(phone('second'));
    await findAllText('mobile.home.title');
    await act(() => router.push('/courier'));
    expect(await findText('mobile.mode.pending')).toBeTruthy();
    expect(screen.queryByText(t('mobile.courier.later'))).toBeNull();
  });
});

describe('links, version floor and availability', () => {
  it.each([['/orders/o-1'], ['/handoff/x'], ['/operator/login']])('%s is not an ordinary route: one neutral not-found screen', async (url) => {
    await boot(url);
    expect(await findText('error.request.not_found')).toBeTruthy();
  });

  it('UPGRADE_REQUIRED replaces the navigator: no tab, no link gets past it, and Check again only passes when the server says so', async () => {
    fixtureHandle.setClient('UPGRADE_REQUIRED');
    await boot('/saved');
    expect(await findText('mobile.gate.upgrade.title')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.tab.home') })).toBeNull();
    await fireEvent.press(button('mobile.gate.upgrade.check_again'));
    expect(await findText('mobile.gate.upgrade.title')).toBeTruthy();
    fixtureHandle.setClient('OK');
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.gate.upgrade.check_again') }, WAIT));
    expect(await findText('error.auth.authentication_required')).toBeTruthy(); // the parked /saved link, now for a guest
  });

  it('a release-like build (no fixture flag) is honest: the live service cannot be reached and no banner is shown', async () => {
    fixturesOn(false);
    await boot();
    expect(await findText('mobile.gate.unavailable_notice')).toBeTruthy();
    expect(screen.queryByText(FIXTURE_BANNER)).toBeNull();
  });
});
