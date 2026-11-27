// M01-R10 / M01-R12 / M01-R03: MOB-FE-03 engagement through MOUNTED routes: the guest gate and its return, pending, confirmed and
// failed states, repeated taps, independent Like and Save, the same Scene in two places, account switching, a write still in
// flight at sign-out, Follow, and the Reviews entry.
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { fixtureHandle, PERSONAS } from '../fixtures';
import { t } from '../i18n/messages';
import { resetSecureStore } from '../testing/secure-store-mock';
import { boot, bottomTab, button, findText, fixturesOn, signInThroughScreens, WAIT } from '../testing/routes';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(120_000);

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;
const CAPTION = 'Demonstration scene: a corner with a basket and a stool.';
const first = (key: Parameters<typeof t>[0]) => screen.getAllByRole('button', { name: t(key) })[0] as ReturnType<typeof screen.getByRole>;
const firstAsync = async (key: Parameters<typeof t>[0]) => (await screen.findAllByRole('button', { name: t(key) }, WAIT))[0] as ReturnType<typeof screen.getByRole>;

beforeEach(() => {
  fixtureHandle.reset();
  resetSecureStore();
  fixturesOn(true);
});
afterAll(() => fixturesOn(false));

async function signedInAtHome(persona: string) {
  const r = await boot('/auth/sign-in');
  await signInThroughScreens(phone(persona));
  await screen.findByText(CAPTION, undefined, WAIT);
  return r;
}

describe('the guest gate', () => {
  it('a guest tapping Like goes to sign-in and comes back to Home, where nothing was done on their behalf', async () => {
    const r = await boot();
    await screen.findByText(CAPTION, undefined, WAIT);
    await fireEvent.press(first('mobile.engagement.like'));
    await signInThroughScreens(phone('second'));
    await screen.findByText(CAPTION, undefined, WAIT);
    expect(r.getPathname()).toBe('/home');
    expect(await firstAsync('mobile.engagement.like')).toBeTruthy(); // not replayed: still "Like"
    expect(fixtureHandle.opLog.some((e) => e.op === 'scene.like.set')).toBe(false);
  });
});

describe('server-confirmed states', () => {
  it('pending shows "Updating." and ignores repeated taps; confirmation shows the server state; Like and Save are independent', async () => {
    await signedInAtHome('second');
    const release = fixtureHandle.hold('scene.save.set');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    const pending = await firstAsync('mobile.engagement.updating');
    expect(pending.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(pending);
    await fireEvent.press(pending);
    await act(async () => release());
    expect(await firstAsync('mobile.engagement.unsave')).toBeTruthy();
    expect(fixtureHandle.opLog.filter((e) => e.op === 'scene.save.set')).toHaveLength(1);
    expect(first('mobile.engagement.like')).toBeTruthy(); // Save did not Like it
    await fireEvent.press(first('mobile.engagement.like'));
    expect(await firstAsync('mobile.engagement.unlike')).toBeTruthy();
    expect(first('mobile.engagement.unsave')).toBeTruthy();
    expect(screen.queryByText(/\d+ likes?/i)).toBeNull(); // no public Like count anywhere
  });

  it('a failed write says it could not confirm, and the control shows the server state again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await signedInAtHome('second');
    fixtureHandle.failNext('scene.save.set', 'NETWORK');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t('mobile.engagement.not_confirmed')), WAIT);
    expect(await firstAsync('mobile.engagement.save')).toBeTruthy();
    announce.mockRestore();
  });

  it('the same Scene saved on Home shows as saved in Saved too (one server state, every representation)', async () => {
    await signedInAtHome('second');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    await firstAsync('mobile.engagement.unsave');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    expect(await findText('mobile.saved.scenes')).toBeTruthy();
    expect(await firstAsync('mobile.engagement.unsave')).toBeTruthy();
  });
});

describe('isolation between Accounts', () => {
  it('after switching Account, the second Account sees none of the first Account saves', async () => {
    await signedInAtHome('owner');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    await firstAsync('mobile.engagement.unsave');
    await act(() => router.push('/auth/sign-in'));
    await signInThroughScreens(phone('second'));
    await screen.findByText(CAPTION, undefined, WAIT);
    expect(await firstAsync('mobile.engagement.save')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.engagement.unsave') })).toBeNull();
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    expect(await findText('mobile.saved.empty')).toBeTruthy();
  });

  it('a Save still in flight when the person signs out never shows as pending or saved afterwards', async () => {
    await signedInAtHome('second');
    const release = fixtureHandle.hold('scene.save.set');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    await firstAsync('mobile.engagement.updating');
    await fireEvent.press(bottomTab(t('mobile.tab.account')));
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.account.sign_out') }, WAIT));
    await fireEvent.press(bottomTab(t('mobile.tab.home')));
    await act(async () => release());
    expect(await firstAsync('mobile.engagement.save')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.engagement.updating') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('mobile.engagement.unsave') })).toBeNull();
  });
});

describe('Follow and Reviews', () => {
  it('Follow on a Seller profile is confirmed, and that Seller appears in Following', async () => {
    await signedInAtHome('second');
    await act(() => router.push('/sellers/fx_seller_demo_alem'));
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.engagement.follow') }, WAIT));
    expect(await screen.findByRole('button', { name: t('mobile.engagement.unfollow') }, WAIT)).toBeTruthy();
    await act(() => router.push('/home'));
    await fireEvent.press(await screen.findByRole('tab', { name: t('mobile.home.channel.following') }, WAIT));
    expect((await screen.findAllByText(CAPTION, undefined, WAIT)).length).toBeGreaterThan(0);
  });

  it('the Reviews entry on a Product opens its Seller Reviews, which says they are not available yet', async () => {
    await boot('/product/fx_product_demo_1');
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.product.reviews') }, WAIT));
    expect(await findText('mobile.seller.reviews_unavailable')).toBeTruthy();
    expect(button('mobile.engagement.follow')).toBeTruthy();
  });
});

describe('Share and Report entries are honest unavailable states (MOB-FE-03)', () => {
  const opsServed = () => fixtureHandle.opLog.length;

  it.each([
    ['a Product', '/product/fx_product_demo_1'],
    ['a Seller', '/sellers/fx_seller_demo_alem'],
    ['a Scene', '/scenes/fx_scene_demo_1'],
  ])('%s: each entry says it is not available, and nothing is sent', async (_name, url) => {
    await boot(url);
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.share.entry') }, WAIT));
    expect(await findText('mobile.share.unavailable')).toBeTruthy();
    const served = opsServed();
    await fireEvent.press(button('mobile.report.entry'));
    expect(await findText('mobile.report.unavailable')).toBeTruthy();
    expect(screen.queryByText(t('mobile.share.unavailable'))).toBeNull(); // one sentence at a time
    await fireEvent.press(button('mobile.share.entry'));
    expect(opsServed()).toBe(served); // no request of any kind sits behind either entry
  });
});

describe('guest continuation and private saved content (MOB-FE-03)', () => {
  it('a guest who taps Save on a Product signs in and returns to that Product; the Save is NOT replayed on their behalf', async () => {
    const r = await boot('/product/fx_product_demo_1');
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.engagement.save') }, WAIT));
    await signInThroughScreens(phone('second'));
    expect(await screen.findByRole('button', { name: t('mobile.engagement.save') }, WAIT)).toBeTruthy();
    expect(r.getPathname()).toBe('/product/fx_product_demo_1');
    expect(screen.queryByRole('button', { name: t('mobile.engagement.unsave') })).toBeNull();
  });

  it('a guest who opens a private Collection link signs in and lands on You, never on the Collection', async () => {
    const r = await boot('/collections/fx_collection_demo_1');
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.auth.sign_in') }, WAIT));
    await signInThroughScreens(phone('second'));
    await screen.findByRole('button', { name: t('mobile.account.sign_out') }, WAIT);
    expect(r.getPathname()).toBe('/account');
  });

  it('after sign-out and sign-in again, a failed read of the saved list shows an error, never the earlier list from a cached copy', async () => {
    await signedInAtHome('second');
    await fireEvent.press(await firstAsync('mobile.engagement.save'));
    await firstAsync('mobile.engagement.unsave');
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    expect(await findText('mobile.saved.scenes')).toBeTruthy();
    await fireEvent.press(bottomTab(t('mobile.tab.account')));
    await fireEvent.press(await screen.findByRole('button', { name: t('mobile.account.sign_out') }, WAIT));
    await fireEvent.press(bottomTab(t('mobile.tab.saved')));
    await findText('error.auth.authentication_required');
    expect(screen.queryByText(t('mobile.saved.scenes'))).toBeNull();
    fixtureHandle.failNext('saved.list.get', 'NETWORK');
    await fireEvent.press(button('mobile.auth.sign_in'));
    await signInThroughScreens(phone('second'));
    expect(await screen.findByRole('button', { name: t('mobile.state.retry') }, WAIT)).toBeTruthy();
    expect(screen.queryByText(t('mobile.saved.scenes'))).toBeNull(); // the read failed: nothing private is drawn from any earlier copy
  });
});
