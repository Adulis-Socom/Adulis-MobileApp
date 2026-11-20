import { am, en, type MobileMessageKey } from '@adulis/locale/mobile';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { GoneState } from '../buyer/ReadStates';
import { SceneCard } from '../buyer/SceneCard';
import { useUiStore } from '../state/ui-store';
import { fypUnit } from '../testing/fake-api';
import { LONG, MIXED, SENTENCE, STORE_NAME, UNBROKEN } from '../testing/ethiopic';
import { productionSources } from '../testing/source-scan';
import { themes } from '../theme/theme';
import { AlertText, StatusText } from './AlertText';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorState } from './ErrorState';
import { Placeholder } from './Placeholder';
import { Screen } from './Screen';
import { TextField } from './TextField';
import { UpgradeRequired } from './UpgradeRequired';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * Long Ge'ez, mixed and unbroken text, and every sentence of the catalogue (English and Amharic), in
 * the components that draw sentences, on a screen the Dimensions mock reports as 360dp wide at 200%
 * type.
 *
 * WHAT JEST CAN PROVE here: in the rendered tree, every word of every sentence is in one text node
 * (nothing cuts, ellipsises or slices it); no text node has a line limit (`numberOfLines`); no text
 * sits inside a box with a fixed `height` or `maxHeight`; a field keeps `minHeight` (the touch target)
 * and no `height`; and each title the navigator draws is a short name. These are the props that
 * decide whether text can grow with its content and with the type size.
 *
 * WHAT JEST CANNOT PROVE: Jest has no layout engine, so it cannot show where a line breaks, that a
 * Ge'ez glyph is not clipped at the line height, that text does not overlap its neighbour, that the
 * keyboard leaves the field visible, that an unbroken run wraps inside the screen width, or that the
 * navigator's own tab label and header title (clamped to one line by the library) fit. Those are
 * device checks at 360dp, 200% type, in Amharic and in English; none has been run.
 */

const WINDOW = Dimensions.get('window');
const SCREEN = Dimensions.get('screen');
const phone360AtLargeType = () =>
  Dimensions.set({
    window: { ...WINDOW, width: 360, height: 640, fontScale: 2 },
    screen: { ...SCREEN, width: 360, height: 640, fontScale: 2 },
  });

type Node = { parent: Node | null; props: Record<string, unknown>; type: unknown };
const flat = (node: Node) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const fixedBox = (node: Node) => {
  for (let up = node.parent; up; up = up.parent) {
    if (typeof up.type !== 'string') continue;
    const style = flat(up);
    if (style.height !== undefined || style.maxHeight !== undefined) return up;
  }
  return null;
};
const wrappingAncestor = (node: Node) => {
  for (let up = node.parent; up; up = up.parent) if (typeof up.type === 'string' && flat(up).flexWrap === 'wrap') return up;
  return null;
};
const textOf = (node: Node) => [node.props.children].flat(Infinity).join('');

/** Every text on screen with a fixed-height box around it, and every text with a line limit. */
const inFixedBoxes = () => screen.getAllByText(/[\s\S]/).filter((node) => fixedBox(node as never)).map((node) => textOf(node as never));
const clamped = () => screen.getAllByText(/[\s\S]/).filter((node) => node.props.numberOfLines !== undefined).map((node) => textOf(node as never));

beforeEach(() => {
  phone360AtLargeType();
  useUiStore.setState({ themePreference: 'light', locale: 'en' });
});
afterEach(() =>
  act(() => {
    Dimensions.set({ window: WINDOW, screen: SCREEN });
    useUiStore.setState({ themePreference: 'system' });
  }),
);

const noop = () => undefined;
const SHARED: [string, ReactElement][] = [
  ['Button', <Button key="b" label={SENTENCE} onPress={noop} />],
  ['a secondary Button', <Button key="s" label={MIXED} variant="secondary" onPress={noop} />],
  ['Checkbox', <Checkbox key="c" label={LONG} checked={false} onChange={noop} />],
  [
    'ChoiceGroup',
    <ChoiceGroup
      key="g"
      label={SENTENCE}
      value="a"
      onChange={noop}
      options={[
        { value: 'a', label: LONG },
        { value: 'b', label: UNBROKEN },
      ]}
    />,
  ],
  ['TextField', <TextField key="t" label={SENTENCE} hint={LONG} error={LONG} value={MIXED} onChangeText={noop} />],
  ['Placeholder', <Placeholder key="p" message={LONG} note={UNBROKEN} />],
  ['AlertText', <AlertText key="a">{LONG}</AlertText>],
  [
    'Screen',
    <Screen key="sc" title={LONG}>
      <Placeholder message={MIXED} />
    </Screen>,
  ],
];

describe('shared components with long Ge\'ez, mixed and unbroken text at 360dp and 200% type', () => {
  it.each(SHARED)('%s keeps every string whole, with no line limit and no fixed-height box around text', async (_name, element) => {
    await render(element);
    expect(inFixedBoxes()).toEqual([]);
    expect(clamped()).toEqual([]);
    const texts = screen.getAllByText(/[\s\S]/).map((node) => textOf(node as never));
    expect(texts.length).toBeGreaterThan(0);
    // No string is cut or ellipsised in the data the layout receives.
    expect(texts.filter((text) => text.endsWith('...') || text.endsWith('\u{2026}'))).toEqual([]);
  });

  it('Button, Checkbox and ChoiceGroup options name themselves with the whole string', async () => {
    await render(
      <>
        <Button label={SENTENCE} onPress={noop} />
        <Checkbox label={LONG} checked={false} onChange={noop} />
        <ChoiceGroup label="Language" value="b" onChange={noop} options={[{ value: 'b', label: UNBROKEN }]} />
      </>,
    );
    expect(screen.getByRole('button', { name: SENTENCE })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: LONG })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: UNBROKEN })).toBeOnTheScreen();
  });

  it('a field label, hint and error each wrap as text, and the field itself stays at least the touch target tall', async () => {
    await render(<TextField label={LONG} hint={LONG} error={LONG} value="" onChangeText={noop} multiline />);
    const input = screen.getByLabelText(LONG);
    expect(flat(input as never).minHeight).toBe(themes.light.touchTarget);
    expect(flat(input as never).height).toBeUndefined();
    expect(screen.getAllByText(LONG)).toHaveLength(3);
  });
});

describe('the checked Checkbox tick', () => {
  it('is the one text inside a fixed-height box here: a single character in the box that holds it', async () => {
    await render(<Checkbox label={LONG} checked onChange={noop} />);
    expect(inFixedBoxes()).toEqual(['\u{2713}']);
  });
});

describe('a For You card with a long Ge\'ez store name and caption', () => {
  const mediaOrigin = 'https://media.example.test';
  const card = (store: string, caption: string) =>
    render(
      <SceneCard
        mediaOrigin={mediaOrigin}
        unit={fypUnit(1, {
          seller: { handle: 'selam-shop', store_name: store },
          caption,
          products: [
            { position: 1, slug: 'a', name: LONG, available: true },
            { position: 2, slug: 'b', name: UNBROKEN, available: false },
            { position: 3, slug: 'c', name: MIXED, available: true },
            { position: 4, slug: 'd', name: SENTENCE, available: true },
          ],
        })}
      />,
    );

  it('keeps the whole store name and caption in its one accessible name, and wraps the product tags', async () => {
    await card(`${STORE_NAME} ${LONG}`, LONG);
    const label = screen.getByLabelText(new RegExp(STORE_NAME.slice(0, 3)));
    expect(label.props.accessibilityLabel).toContain(`${STORE_NAME} ${LONG}`);
    expect(label.props.accessibilityLabel).toContain(LONG);
    // Tags are text in boxes that grow, in a row that wraps; a long name wraps inside its tag.
    const tag = screen.getByText(`${UNBROKEN} (${en['buyer.for_you.product_unavailable']})`);
    expect(flat(tag as never).height).toBeUndefined();
    expect(tag.props.numberOfLines).toBeUndefined();
    const row = wrappingAncestor(tag as never);
    expect(row).not.toBeNull();
    expect(flat(row as never).flexDirection).toBe('row');
  });

  it('clamps the store name and the caption to two lines in the card, the only text in it that is clamped', async () => {
    await card(`${STORE_NAME} ${LONG}`, LONG);
    expect(clamped()).toEqual([`${STORE_NAME} ${LONG}`, LONG]);
    for (const node of screen.getAllByText(/[\s\S]/).filter((n) => n.props.numberOfLines !== undefined)) {
      expect(node.props.numberOfLines).toBe(2);
    }
  });

  it('keeps the explore button at least the touch target tall', async () => {
    await card(STORE_NAME, SENTENCE);
    expect(flat(screen.getByRole('button') as never).minHeight).toBe(themes.light.touchTarget);
  });

  const cp = (...codes: number[]) => String.fromCodePoint(...codes);
  it.each([
    ['a two-word Ge\'ez name', STORE_NAME, cp(0x1230, 0x1231)],
    ['a long name: only the first two words count', `${STORE_NAME} ${LONG}`, cp(0x1230, 0x1231)],
    ['a Latin name, upper-cased', 'abebe kebede', 'AK'],
    ['a mixed name', `ADULIS ${STORE_NAME}`, `A${cp(0x1230)}`],
    ['one word', 'Basket', 'B'],
    ['an emoji first, kept whole', `${cp(0x1f600)} Shop`, `${cp(0x1f600)}S`],
    ['extra white space', '   Basket    House  ', 'BH'],
  ])('shows the avatar initials of %s, at most two characters in the fixed avatar', async (_label, store, initials) => {
    await card(store, 'caption');
    expect(inFixedBoxes()).toEqual([initials]);
  });
});

/** Every distinct sentence of the catalogue in one language, longest first, so a failure names the worst one. */
const sentencesOf = (catalogue: Record<MobileMessageKey, string>) =>
  [...new Set(Object.values(catalogue).filter((text) => text !== ''))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));

/** The components that draw a catalogue sentence, each given the sentences as its own text. */
const SENTENCE_SURFACES: [name: string, draw: (sentences: string[]) => ReactElement][] = [
  ['Button', (all) => <>{all.map((s, i) => <Button key={i} label={s} onPress={noop} />)}</>],
  ['a secondary Button', (all) => <>{all.map((s, i) => <Button key={i} label={s} variant="secondary" onPress={noop} />)}</>],
  ['Checkbox', (all) => <>{all.map((s, i) => <Checkbox key={i} label={s} checked={false} onChange={noop} />)}</>],
  // No option is selected: a selected option draws a check mark before its label (the next test covers that).
  ['ChoiceGroup options', (all) => <ChoiceGroup label="Choose" value="none" onChange={noop} options={all.map((s, i) => ({ value: String(i), label: s }))} />],
  ['TextField label, hint and error', (all) => <>{all.map((s, i) => <TextField key={i} label={s} hint={s} error={s} value="" onChangeText={noop} />)}</>],
  ['Placeholder message and note', (all) => <>{all.map((s, i) => <Placeholder key={i} message={s} note={s} />)}</>],
  ['Screen title', (all) => <>{all.map((s, i) => <Screen key={i} title={s}><Placeholder message="." /></Screen>)}</>],
  ['AlertText', (all) => <>{all.map((s, i) => <AlertText key={i}>{s}</AlertText>)}</>],
  ['StatusText', (all) => <>{all.map((s, i) => <StatusText key={i}>{s}</StatusText>)}</>],
];

describe('every catalogue sentence at 360dp and 200% type, in every component that draws a sentence', () => {
  it('the screen the components are drawn on is 360dp wide at 200% type', () => {
    expect(Dimensions.get('window').width).toBe(360);
    expect(Dimensions.get('window').fontScale).toBe(2);
    expect(Dimensions.get('screen').fontScale).toBe(2);
  });

  it.each(
    SENTENCE_SURFACES.flatMap(([name, draw]) => [
      [name, 'English', en, draw] as const,
      [name, 'Amharic', am, draw] as const,
    ]),
  )('%s, %s: every sentence reaches a text node whole, with no line limit and no fixed-height box around text', async (_name, _language, catalogue, draw) => {
    const sentences = sentencesOf(catalogue);
    expect(sentences.length).toBeGreaterThan(400);
    await render(draw(sentences));
    const drawn = new Set(screen.getAllByText(/[\s\S]/).map((node) => textOf(node as never)));
    expect(sentences.filter((sentence) => !drawn.has(sentence))).toEqual([]);
    expect(inFixedBoxes()).toEqual([]);
    expect(clamped()).toEqual([]);
  }, 120_000);

  it.each(['en', 'am'] as const)('the notice screens (route error, update required, gone) keep their catalogue sentences whole in %s', async (locale) => {
    await act(async () => useUiStore.setState({ locale }));
    const catalogue = locale === 'en' ? en : am;
    await render(
      <>
        <ErrorState retry={async () => undefined} />
        <UpgradeRequired onCheckAgain={noop} checking={false} />
        <GoneState message="buyer.scene.gone" />
      </>,
    );
    const drawn = new Set(screen.getAllByText(/[\s\S]/).map((node) => textOf(node as never)));
    const expected = ['error.request.internal', 'common.retry', 'app.upgrade.required.title', 'app.upgrade.required.body', 'app.upgrade.check_again', 'buyer.scene.gone', 'buyer.scene.go_back'] as const;
    expect(expected.filter((key) => !drawn.has(catalogue[key]))).toEqual([]);
    expect(inFixedBoxes()).toEqual([]);
    expect(clamped()).toEqual([]);
  });
});

describe('what the navigator draws: tab labels and header titles', () => {
  // expo-router's navigator draws these, not this app, and it clamps both to ONE line (Label.js and
  // HeaderTitle.js set numberOfLines: 1). A sentence there would be cut on a 360dp screen. What the
  // app controls is the text: every title key used in the route layouts is a short name, in both
  // languages, and the tab bar also names each tab in full for the screen reader.
  const TITLE_KEY = /(?:\btitle|\btabBarAccessibilityLabel|\bheaderTitle|\btabBarLabel)\s*:\s*t\('([a-z0-9_.]+)'\)/g;
  const keys = [
    ...new Set(
      productionSources('app').flatMap(({ text }) => [...text.matchAll(TITLE_KEY)].map((match) => match[1] as MobileMessageKey)),
    ),
  ];
  const MOST_CHARACTERS = 24;

  it('reads the title keys of the tab bar and of the Buyer and Seller Companion stacks', () => {
    expect(keys.length).toBeGreaterThanOrEqual(20);
    for (const key of ['buyer.tab.home', 'buyer.tab.you', 'buyer.messages', 'seller.title', 'seller.orders.title'] as const) {
      expect({ key, read: keys.includes(key) }).toEqual({ key, read: true });
    }
  });

  it.each(keys)('%s is a short name in English and in Amharic, not a sentence', (key) => {
    for (const catalogue of [en, am]) {
      expect(catalogue[key].length).toBeLessThanOrEqual(MOST_CHARACTERS);
      expect(catalogue[key]).not.toMatch(/[.!?\u{1362}]$/u);
    }
  });
});
