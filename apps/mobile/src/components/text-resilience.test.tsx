import { en } from '@adulis/locale/mobile';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { SceneCard } from '../buyer/SceneCard';
import { useUiStore } from '../state/ui-store';
import { fypUnit } from '../testing/fake-api';
import { LONG, MIXED, SENTENCE, STORE_NAME, UNBROKEN } from '../testing/ethiopic';
import { themes } from '../theme/theme';
import { AlertText } from './AlertText';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { ChoiceGroup } from './ChoiceGroup';
import { Placeholder } from './Placeholder';
import { Screen } from './Screen';
import { TextField } from './TextField';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * Long Ge'ez, mixed and unbroken text on a 360dp-wide screen at 200% type. Jest has no layout
 * engine, so what is checked is what decides the layout: no height or line limit on text, no
 * fixed-height box holding a text block, and the whole string reaching the screen reader.
 * Whether a line breaks well on a device is a device check.
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
