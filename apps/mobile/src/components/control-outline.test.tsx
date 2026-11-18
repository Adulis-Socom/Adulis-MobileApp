import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { themes } from '../theme/theme';
import { blend, contrast } from '../testing/contrast';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { ChoiceGroup } from './ChoiceGroup';
import { TextField } from './TextField';

/**
 * The shared controls that have no outline but their own edge (a text field, the quiet Button, an
 * unchosen option, an unchecked box) draw it in `borderStrong`, and it stays at least 3:1 against
 * the page and a card in both themes. A disabled control still reads as disabled. The token's own
 * ratios are in theme/contrast.test.ts; here the components are rendered and read.
 */

type Styled = { props: { style?: unknown } };
const flat = (node: Styled) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const noop = () => undefined;
const MODES = ['light', 'dark'] as const;
const options = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic' },
] as const;

afterEach(() => useUiStore.setState({ themePreference: 'system', locale: 'en' }));

describe.each(MODES)('control outlines in the %s theme', (mode) => {
  const color = themes[mode].color;
  beforeEach(() => useUiStore.setState({ themePreference: mode, locale: 'en' }));

  const CONTROLS: readonly (readonly [string, () => Promise<Styled>])[] = [
    [
      'a text field',
      async () => {
        await render(<TextField label="Phone" value="" onChangeText={noop} />);
        return screen.getByLabelText('Phone');
      },
    ],
    [
      'the quiet Button',
      async () => {
        await render(<Button label="Resend" variant="secondary" onPress={noop} />);
        return screen.getByRole('button', { name: 'Resend' });
      },
    ],
    [
      'an unchosen option',
      async () => {
        await render(<ChoiceGroup label="Language" value="en" onChange={noop} options={options} />);
        return screen.getByRole('radio', { name: 'Amharic' });
      },
    ],
    [
      'an unchecked box',
      async () => {
        await render(<Checkbox label="Gifts" checked={false} onChange={noop} />);
        // The box is the first thing the row draws; the label follows.
        return screen.getByRole('checkbox', { name: 'Gifts' }).children[0] as unknown as Styled;
      },
    ],
  ];

  it.each(CONTROLS)('%s draws its edge in borderStrong on the page colour, at least 3:1 against the page and a card', async (_name, draw) => {
    const style = flat(await draw());
    expect(style.borderColor).toBe(color.borderStrong);
    // The control fills itself with the page colour, so the edge is measured against that.
    expect(style.backgroundColor).toBe(color.bg);
    expect(contrast(style.borderColor as string, color.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(style.borderColor as string, color.surface)).toBeGreaterThanOrEqual(3);
  });

  // An inactive control is dimmed as a whole: its edge falls under the 3:1 an active one has, so a
  // stronger edge does not make a disabled control look available.
  it.each([
    [
      'the quiet Button',
      () => <Button label="Resend" variant="secondary" onPress={noop} disabled />,
      () => screen.getByRole('button', { name: 'Resend' }),
    ],
    [
      'a Checkbox',
      () => <Checkbox label="Gifts" checked={false} onChange={noop} disabled />,
      () => screen.getByRole('checkbox', { name: 'Gifts' }),
    ],
  ])('%s that is disabled is dimmed, and its edge no longer reads as an active one', async (_name, element, find) => {
    await render(element());
    const opacity = flat(find()).opacity as number;
    expect(opacity).toBeLessThan(1);
    const dimmed = blend(color.borderStrong, color.bg, opacity);
    expect(contrast(dimmed, color.bg)).toBeLessThan(3);
    expect(contrast(dimmed, color.bg)).toBeLessThan(contrast(color.borderStrong, color.bg));
  });
});
