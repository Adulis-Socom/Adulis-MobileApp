// M01-R10: MOB-FE-02S through MOUNTED routes: the Stories row on Home, opening the viewer from it, the link action, Close, and a
// Seller whose Stories are withdrawn between the row and the opening. (Screen-reader focus returning to the entry is code that
// only a device can observe: Jest has no native view to focus. It is in the native walkthrough, not claimed here.)
import { fireEvent, screen } from 'expo-router/testing-library';

import { fixtureHandle } from '../fixtures';
import { t } from '../i18n/messages';
import { resetSecureStore } from '../testing/secure-store-mock';
import { boot, button, findAllText, findText, fixturesOn, WAIT } from '../testing/routes';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(90_000);

beforeEach(() => {
  fixtureHandle.setNow(null);
  fixtureHandle.reset();
  resetSecureStore();
  fixturesOn(true);
});
afterAll(() => fixturesOn(false));

const entry = (seller: string) => screen.findByRole('button', { name: t('mobile.stories.entry', { seller }) }, WAIT);

describe('Seller Stories', () => {
  it('opens from the Home row with a fresh read: photo, text, position, time left; Close returns to Home', async () => {
    const r = await boot();
    await fireEvent.press(await entry('Demo Store Bete'));
    expect(await findText('mobile.stories.position', { n: 1, total: 1 })).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Story from Demo Store Bete' })).toBeTruthy();
    expect(screen.getByText('New scarves on the line.')).toBeTruthy();
    expect(screen.getByText(/hours? left\.$/)).toBeTruthy();
    expect(r.getPathname()).toBe('/stories/fx_seller_demo_bete');
    await fireEvent.press(button('mobile.stories.close'));
    expect(await entry('Demo Store Bete')).toBeTruthy();
    expect(r.getPathname()).toBe('/home');
  });

  it('a Story link only navigates: a Scene link opens Explore the Scene', async () => {
    await boot();
    await fireEvent.press(await entry('Demo Store Bete'));
    await findText('mobile.stories.position', { n: 1, total: 1 });
    await fireEvent.press(button('mobile.scene.explore'));
    expect(await findText('mobile.scene.in_this_scene')).toBeTruthy();
  });

  it('a photo-only Story has no action; Next and Previous move only when pressed', async () => {
    await boot();
    await fireEvent.press(await entry('Demo Store Alem'));
    await findText('mobile.stories.position', { n: 1, total: 2 });
    expect(button('mobile.stories.previous').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button('mobile.stories.next'));
    expect(await findText('mobile.stories.position', { n: 2, total: 2 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.scene.view_product') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('mobile.scene.explore') })).toBeNull();
  });

  it('Stories withdrawn after the row was drawn: opening shows one neutral sentence and Close, never the old photo', async () => {
    await boot();
    const bete = await entry('Demo Store Bete');
    fixtureHandle.expireStories('fx_seller_demo_bete');
    await fireEvent.press(bete);
    expect((await findAllText('mobile.stories.gone')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('image', { name: 'Story from Demo Store Bete' })).toBeNull();
    expect(button('mobile.stories.close')).toBeTruthy();
  });
});
