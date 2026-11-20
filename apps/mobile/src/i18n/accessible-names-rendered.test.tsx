import { en } from '@adulis/locale/mobile';
import { renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, shopProduct } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * The static scan in accessible-names.test.ts reads the sources; this draws four screens as a Buyer sees
 * them and asks the way a screen reader does: every control with a button, tab, link, checkbox or radio
 * role has a non-empty accessible name, which is its own label or the words inside it. Text that is
 * hidden from the screen reader is not a name, and neither is an icon-font glyph (a private-use
 * character, which a screen reader has nothing to say for), hidden or not.
 *
 * WHAT IT COVERS: Home (For You, the header buttons, the channels and the five bottom tabs), the You tab
 * as a guest, the You tab signed in (sessions, Sign out, Delete Account, Messages) and the Shop with one
 * Product. Roles: button, tab, link, checkbox, radio.
 *
 * WHAT IT DOES NOT: Saved, Orders, Search, Product, Seller profile, Messages, Chat, Notifications,
 * sign-in and verify, Delete Account, the Seller Companion, and the roles textbox, switch and image. The
 * static scan reads the sources of all of them; it is the wider net, this is the drawn-screen check.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const ROLES = ['button', 'tab', 'link', 'checkbox', 'radio'] as const;

type Node = { props: Record<string, unknown>; children: (Node | string)[] };

const hidden = (node: Node) =>
  node.props.accessibilityElementsHidden === true ||
  node.props['aria-hidden'] === true ||
  String(node.props.importantForAccessibility ?? '').startsWith('no');

/** Icon fonts draw their glyphs from the Unicode private use area (U+E000 to U+F8FF), written as code so this file stays ASCII. */
const ICON_GLYPHS = new RegExp(
  `[${String.fromCodePoint(0xe000)}-${String.fromCodePoint(0xf8ff)}]`,
  'gu',
);

/** What a screen reader would say for this node: its own label, else the visible words inside it. */
function spoken(node: Node | string): string {
  if (typeof node === 'string') return node.replace(ICON_GLYPHS, '');
  if (hidden(node)) return '';
  const label = node.props['aria-label'] ?? node.props.accessibilityLabel;
  if (typeof label === 'string' && label.trim() !== '') return label;
  return node.children.map(spoken).join(' ');
}

function expectEveryControlNamed() {
  let controls = 0;
  for (const role of ROLES) {
    const all = screen.queryAllByRole(role) as unknown as Node[];
    controls += all.length;
    const unnamed = all.filter((control) => spoken(control).trim() === '').length;
    expect({ role, unnamed }).toEqual({ role, unnamed: 0 });
  }
  expect(controls).toBeGreaterThan(5);
}

const CURRENT_SESSION = {
  id: '5e000000-0000-4000-8000-00000000000a',
  audience: 'MOBILE',
  first_seen_at: '2026-11-10T09:00:00.000Z',
  last_activity_at: '2026-11-12T08:30:00.000Z',
  approx_location: null,
  expires_at: '2026-12-10T09:00:00.000Z',
  device_platform: 'ANDROID',
  remembered_label: null,
  remembered_device_id: null,
  remembered: false,
  current: true,
};

let api: ReturnType<typeof installFakeApi>;

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({
    activeMode: null,
    themePreference: 'system',
    locale: 'en',
    upgradeNoticeDismissed: false,
  });
});

describe('the check itself', () => {
  const part = (props: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
    props,
    children,
  });
  const glyph = String.fromCodePoint(0xf3e1);

  it('hears a label and words, and nothing for an icon glyph or a hidden node', () => {
    expect(spoken(part({}, glyph)).trim()).toBe('');
    expect(spoken(part({}, part({ accessibilityElementsHidden: true }, 'Save'))).trim()).toBe('');
    expect(spoken(part({ accessibilityLabel: 'Save' }, glyph)).trim()).toBe('Save');
    expect(spoken(part({ 'aria-label': ' ' }, glyph)).trim()).toBe('');
    expect(spoken(part({}, glyph, 'Save')).trim()).toBe('Save');
  });
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

  it('You, signed in: Sign out, Delete Account, Messages and the session rows', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on('GET /v1/auth/sessions', () => ({ status: 200, body: { data: [CURRENT_SESSION] } }));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.you.session.current'])).toBeOnTheScreen();
    expectEveryControlNamed();
  });

  it('Shop: a Product tile and its Save button', async () => {
    api.on('GET /v1/categories', () => ({
      status: 200,
      body: { market_resolved: true, data: [] },
    }));
    api.on('GET /v1/shop/products', () => ({
      status: 200,
      body: { market_resolved: true, data: [shopProduct('mug', 'Plain mug')], next_cursor: null },
    }));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    expect(await screen.findByLabelText(/^Plain mug,/)).toBeOnTheScreen();
    expectEveryControlNamed();
  });
});
