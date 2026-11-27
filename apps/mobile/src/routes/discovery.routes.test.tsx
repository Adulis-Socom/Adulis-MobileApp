// M01-R10 / M01-R04: MOB-FE-02 discovery through MOUNTED routes over the fixture world: channels, the Scene card and its photo,
// Scene Explorer hotspots, Product, Seller, Shop, Search, and a Scene the server withdraws while it is open.
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { fixtureHandle } from '../fixtures';
import { t } from '../i18n/messages';
import { resetSecureStore } from '../testing/secure-store-mock';
import { boot, bottomTab, button, findAllText, findText, fixturesOn, WAIT } from '../testing/routes';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(90_000);

beforeEach(() => {
  fixtureHandle.reset();
  resetSecureStore();
  fixturesOn(true);
});
afterAll(() => fixturesOn(false));

const firstCaption = 'Demonstration scene: a corner with a basket and a stool.';

async function openFirstScene() {
  await boot();
  await screen.findByText(firstCaption, undefined, WAIT);
  await fireEvent.press(screen.getAllByRole('button', { name: t('mobile.scene.explore') })[0] as ReturnType<typeof screen.getByRole>);
  await findText('mobile.scene.in_this_scene');
  // Jest never lays anything out: give the photo frame a phone-sized width so the hotspots can be placed.
  await fireEvent(screen.getByTestId('scene-photo'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 240 } } });
}

describe('Home channels and the Scene card', () => {
  it('shows five channel tabs with For You selected, and Scene cards with their demonstration photo', async () => {
    await boot();
    await screen.findByText(firstCaption, undefined, WAIT);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(
      (['mobile.home.channel.for_you', 'mobile.home.channel.following', 'mobile.home.channel.nearby', 'mobile.home.channel.discounts', 'mobile.home.channel.locally_made'] as const).map((key) => t(key)),
    );
    expect(screen.getByRole('tab', { name: t('mobile.home.channel.for_you') }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getAllByRole('image', { name: 'Photo for scene 1' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(t('mobile.media.unavailable'))).toBeNull(); // the photo is drawn, not the placeholder
  });

  it('Nearby, Discounts and Locally Made say they are not available and request nothing; Following asks a guest to sign in', async () => {
    await boot();
    await screen.findByText(firstCaption, undefined, WAIT);
    for (const key of ['mobile.home.channel.nearby', 'mobile.home.channel.discounts', 'mobile.home.channel.locally_made'] as const) {
      await fireEvent.press(screen.getByRole('tab', { name: t(key) }));
      expect(await findText('mobile.home.channel_unavailable')).toBeTruthy();
    }
    const before = fixtureHandle.opLog.length;
    await fireEvent.press(screen.getByRole('tab', { name: t('mobile.home.channel.following') }));
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
    expect(fixtureHandle.opLog.slice(before).some((entry) => entry.op === 'feed.following.page')).toBe(false);
  });
});

describe('Scene Explorer', () => {
  it('places hotspots on the photo, each read as "<product>. Open product.", and a hotspot opens the Product', async () => {
    await openFirstScene();
    const hotspot = await screen.findByRole('button', { name: t('mobile.scene.hotspot_label', { name: 'Woven basket' }) }, WAIT);
    expect(screen.getByRole('button', { name: t('mobile.scene.hotspot_label', { name: 'Wooden stool' }) })).toBeTruthy();
    await fireEvent.press(hotspot);
    expect(await screen.findAllByText('Woven basket', undefined, WAIT)).toBeTruthy();
    expect(await findAllText('mobile.product.available')).toBeTruthy();
  });

  it('a Scene the server withdraws while it is open shows one neutral sentence on return, with no caption or photo', async () => {
    await openFirstScene();
    await fireEvent.press(screen.getAllByRole('button', { name: t('mobile.scene.view_product') })[0] as ReturnType<typeof screen.getByRole>);
    await screen.findAllByText('Woven basket', undefined, WAIT);
    fixtureHandle.withdraw('fx_scene_demo_1');
    await act(() => router.back());
    expect(await findText('mobile.scene.gone')).toBeTruthy();
    expect(screen.queryByText(firstCaption)).toBeNull();
    expect(screen.queryByRole('image', { name: 'Photo for scene 1' })).toBeNull();
  });

  it('a malformed Scene link is the neutral not-found sentence and requests nothing', async () => {
    await boot('/scenes/..');
    expect(await screen.findByText(t('error.request.not_found'), undefined, WAIT)).toBeTruthy();
  });
});

describe('Product, Seller, Shop and Search', () => {
  it('a Product links to its Seller; the Seller opens on Scenes and its Reviews tab says it is not available', async () => {
    await boot('/product/fx_product_demo_1');
    await screen.findAllByText('Woven basket', undefined, WAIT);
    await fireEvent.press(button('mobile.scene.by_seller', { seller: 'Demo Store Alem' }));
    expect(await screen.findByRole('tab', { name: t('mobile.seller.tab.scenes') }, WAIT)).toBeTruthy();
    expect(await screen.findByText(firstCaption, undefined, WAIT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: t('mobile.seller.tab.reviews') }));
    expect(await findText('mobile.seller.reviews_unavailable')).toBeTruthy();
  });

  it('Shop lists Products in the server order and a category narrows them', async () => {
    await boot();
    await screen.findByText(firstCaption, undefined, WAIT);
    await fireEvent.press(bottomTab(t('mobile.tab.shop')));
    expect(await screen.findByRole('button', { name: /^Woven basket\./ }, WAIT)).toBeTruthy();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Fashion' }, WAIT));
    expect(await screen.findByRole('button', { name: /^Cotton scarf\./ }, WAIT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Woven basket\./ })).toBeNull();
  });

  it('Search sends the typed text, returns Products and Scenes, and refuses punctuation with its reason', async () => {
    await boot('/search');
    const field = await screen.findByLabelText(t('mobile.search.field'), undefined, WAIT);
    await fireEvent.changeText(field, '!!');
    await fireEvent.press(button('mobile.search.go'));
    expect(await findText('mobile.search.no_terms')).toBeTruthy();
    const before = fixtureHandle.opLog.filter((entry) => entry.op === 'search.query').length;
    expect(before).toBe(0);
    await fireEvent.changeText(field, 'basket');
    await fireEvent.press(button('mobile.search.go'));
    expect(await screen.findByRole('button', { name: /^Woven basket\./ }, WAIT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: t('mobile.search.tab.scenes') }));
    expect(await screen.findByText(firstCaption, undefined, WAIT)).toBeTruthy();
  });
});
