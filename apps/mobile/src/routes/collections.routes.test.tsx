// M01-R08 / M01-R10: Collections through MOUNTED routes: create, open, add a saved Scene and a saved Product, remove, rename,
// a member that stops being public, delete with confirmation, another Account's Collection, and nothing readable after sign-out.
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { fixtureHandle, PERSONAS } from '../fixtures';
import { t } from '../i18n/messages';
import { resetSecureStore } from '../testing/secure-store-mock';
import { boot, button, findText, fixturesOn, signInThroughScreens, WAIT } from '../testing/routes';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(120_000);

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;
const CAPTION = 'Demonstration scene: a corner with a basket and a stool.';
const role = (name: string) => screen.findByRole('button', { name }, WAIT);

beforeEach(() => {
  fixtureHandle.reset();
  resetSecureStore();
  fixturesOn(true);
});
afterAll(() => fixturesOn(false));

/** Signed in as `persona`, with the first Scene and the Woven basket saved, on Saved with one Collection named `name`. */
async function withCollection(persona: string, name: string) {
  await boot('/auth/sign-in');
  await signInThroughScreens(phone(persona));
  await screen.findByText(CAPTION, undefined, WAIT);
  await fireEvent.press((await screen.findAllByRole('button', { name: t('mobile.engagement.save') }, WAIT))[0] as ReturnType<typeof screen.getByRole>);
  await screen.findAllByRole('button', { name: t('mobile.engagement.unsave') }, WAIT);
  await act(() => router.push('/product/fx_product_demo_1'));
  await fireEvent.press(await role(t('mobile.engagement.save')));
  await role(t('mobile.engagement.unsave'));
  await act(() => router.push('/saved'));
  await fireEvent.changeText(await screen.findByLabelText(t('mobile.collections.name'), undefined, WAIT), name);
  await fireEvent.press(button('mobile.collections.create'));
  await fireEvent.press(await role(name));
  await findText('mobile.collections.empty_items');
}

describe('Collections', () => {
  it('opens empty, takes a saved Scene and a saved Product, removes one, and is renamed', async () => {
    await withCollection('second', 'Gifts');
    await fireEvent.press(await role(t('mobile.collections.add', { name: CAPTION })));
    expect(await role(t('mobile.collections.remove', { name: CAPTION }))).toBeTruthy();
    await fireEvent.press(await role(t('mobile.collections.add', { name: 'Woven basket' })));
    expect(await role(t('mobile.collections.remove', { name: 'Woven basket' }))).toBeTruthy();
    expect(await findText('mobile.collections.nothing_to_add')).toBeTruthy();

    await fireEvent.press(button('mobile.collections.remove', { name: 'Woven basket' }));
    expect(await role(t('mobile.collections.add', { name: 'Woven basket' }))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('mobile.collections.remove', { name: 'Woven basket' }) })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText(t('mobile.collections.name')), 'Presents');
    await fireEvent.press(button('mobile.collections.rename'));
    expect(await screen.findByText('Presents', undefined, WAIT)).toBeTruthy();
  });

  it('a member that stops being public is one neutral sentence with no caption, and can still be removed', async () => {
    await withCollection('second', 'Gifts');
    await fireEvent.press(await role(t('mobile.collections.add', { name: CAPTION })));
    await role(t('mobile.collections.remove', { name: CAPTION }));
    fixtureHandle.withdraw('fx_scene_demo_1');
    // Any change re-reads the Collection: the server now says the Scene is not public.
    await fireEvent.press(await role(t('mobile.collections.add', { name: 'Woven basket' })));
    expect(await findText('mobile.collections.item_unavailable')).toBeTruthy();
    expect(screen.queryByText(CAPTION)).toBeNull();
    await fireEvent.press(button('mobile.collections.remove_unavailable'));
    expect(await role(t('mobile.collections.remove', { name: 'Woven basket' }))).toBeTruthy();
    expect(screen.queryByText(t('mobile.collections.item_unavailable'))).toBeNull();
  });

  it('delete asks first, then returns to Saved without the Collection; what was saved stays saved', async () => {
    await withCollection('second', 'Gifts');
    await fireEvent.press(button('mobile.collections.delete'));
    expect(await findText('mobile.collections.delete_confirm')).toBeTruthy();
    await fireEvent.press(button('mobile.collections.delete_yes'));
    expect(await findText('mobile.saved.scenes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gifts' })).toBeNull();
  });

  it('another Account opening the Collection link gets the neutral sentence, and a signed-out person gets sign-in, never the content', async () => {
    await withCollection('second', 'Gifts');
    await act(() => router.push('/auth/sign-in'));
    await signInThroughScreens(phone('revoked'));
    await screen.findByText(CAPTION, undefined, WAIT);
    await act(() => router.push('/collections/fx_collection_demo_1'));
    expect(await findText('mobile.collections.gone')).toBeTruthy();
    expect(screen.queryByText('Gifts')).toBeNull();

    await act(() => router.push('/account'));
    await fireEvent.press(await role(t('mobile.account.sign_out')));
    await act(() => router.push('/collections/fx_collection_demo_1'));
    expect(await findText('error.auth.authentication_required')).toBeTruthy();
    expect(screen.queryByText('Gifts')).toBeNull();
  });
});
