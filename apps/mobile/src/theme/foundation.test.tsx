import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { TextField } from '../components/TextField';
import { useUiStore } from '../state/ui-store';
import { navigationTheme, themes } from './theme';

/** Scales and typography as the Buyer UI receives them: the adapted theme, not the package source. */

const values = (scale: Record<string, number>) => Object.values(scale);
const strictlyIncreasing = (list: number[]) => list.every((value, i) => i === 0 || value > list[i - 1]!);

describe.each(['light', 'dark'] as const)('scales in the %s theme', (mode) => {
  const theme = themes[mode];

  it('spacing grows with every step and sits on the 4dp grid', () => {
    expect(Object.keys(theme.space)).toEqual(['xs', 'sm', 'smd', 'md', 'lg', 'xl', 'xxl']);
    expect(strictlyIncreasing(values(theme.space))).toBe(true);
    for (const step of values(theme.space)) expect(step % 4).toBe(0);
  });

  it('radius grows with every step and full rounds any size', () => {
    expect(Object.keys(theme.radius)).toEqual(['sm', 'md', 'lg', 'full']);
    expect(strictlyIncreasing(values(theme.radius))).toBe(true);
    expect(theme.radius.full).toBeGreaterThanOrEqual(999);
  });

  it('type sizes grow with every step and body text is never below 16dp', () => {
    expect(Object.keys(theme.fontSize)).toEqual(['xs', 'sm', 'base', 'lg', 'xl', 'xxl', '3xl']);
    expect(strictlyIncreasing(values(theme.fontSize))).toBe(true);
    expect(theme.fontSize.base).toBeGreaterThanOrEqual(16);
    expect(theme.fontSize.xs).toBeGreaterThanOrEqual(12);
  });

  it("line height is generous for tall Ge'ez glyphs: 1.5 for body, 1.3 for headings", () => {
    expect(theme.lineHeight.base).toBeGreaterThanOrEqual(1.5);
    expect(theme.lineHeight.heading).toBeGreaterThanOrEqual(1.3);
    expect(strictlyIncreasing(values(theme.lineHeight))).toBe(true);
  });

  it('weights grow with every step', () => {
    expect(strictlyIncreasing(values(theme.fontWeight))).toBe(true);
  });

  it('the touch target is 44dp on both axes', () => {
    expect(theme.touchTarget).toBe(44);
  });
});

describe('the two themes', () => {
  it('differ in colour only: every other value is the same object', () => {
    for (const key of ['space', 'radius', 'fontSize', 'fontWeight', 'lineHeight'] as const) {
      expect(themes.dark[key]).toBe(themes.light[key]);
    }
    expect(themes.dark.touchTarget).toBe(themes.light.touchTarget);
  });

  it("carry no font family: Latin and Ge'ez text both use the platform default", () => {
    for (const theme of Object.values(themes)) {
      expect(Object.keys(theme).sort()).toEqual(
        ['color', 'fontSize', 'fontWeight', 'lineHeight', 'mode', 'radius', 'space', 'touchTarget'].sort(),
      );
    }
  });
});

describe.each(['light', 'dark'] as const)('the navigator theme in the %s theme', (mode) => {
  it('takes every chrome colour from the same roles, so no navigator shows a built-in palette', () => {
    const { color } = themes[mode];
    const nav = navigationTheme(themes[mode]);
    expect(nav.dark).toBe(mode === 'dark');
    expect(nav.colors).toEqual({
      primary: color.accent,
      background: color.bg,
      card: color.surface,
      text: color.text,
      border: color.border,
      notification: color.accent,
    });
  });
});

describe.each(['light', 'dark'] as const)('shared components in the %s theme', (mode) => {
  const theme = themes[mode];
  beforeEach(() => useUiStore.setState({ themePreference: mode }));
  afterEach(() => useUiStore.setState({ themePreference: 'system' }));

  const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

  it('every control keeps at least the 44dp touch target, and none fixes a height', async () => {
    await render(
      <>
        <Button label="Continue" onPress={() => undefined} />
        <Button label="Resend" variant="secondary" onPress={() => undefined} />
        <Checkbox label="Gifts" checked={false} onChange={() => undefined} />
        <ChoiceGroup
          label="Language"
          value="en"
          onChange={() => undefined}
          options={[
            { value: 'en', label: 'English' },
            { value: 'am', label: 'Amharic' },
          ]}
        />
        <TextField label="Phone" value="" onChangeText={() => undefined} />
      </>,
    );
    const controls = [
      screen.getByRole('button', { name: 'Continue' }),
      screen.getByRole('button', { name: 'Resend' }),
      screen.getByRole('checkbox', { name: 'Gifts' }),
      screen.getByRole('radio', { name: 'English' }),
      screen.getByRole('radio', { name: 'Amharic' }),
      screen.getByLabelText('Phone'),
    ];
    for (const control of controls) {
      const flat = style(control);
      expect(flat.minHeight).toBe(theme.touchTarget);
      expect(flat.height).toBeUndefined();
      expect(flat.maxHeight).toBeUndefined();
    }
  });

  it('AppText takes its size, line height and colour from the theme and never fixes a height', async () => {
    await render(
      <>
        <AppText>Body text</AppText>
        <AppText variant="heading">Heading text</AppText>
      </>,
    );
    const body = screen.getByText('Body text');
    const heading = screen.getByText('Heading text');
    expect(style(body)).toMatchObject({
      color: theme.color.text,
      fontSize: theme.fontSize.base,
      lineHeight: Math.round(theme.fontSize.base * theme.lineHeight.base),
      fontWeight: theme.fontWeight.regular,
    });
    expect(style(heading)).toMatchObject({
      color: theme.color.text,
      fontSize: theme.fontSize.xl,
      lineHeight: Math.round(theme.fontSize.xl * theme.lineHeight.heading),
      fontWeight: theme.fontWeight.semibold,
    });
    for (const node of [body, heading]) {
      const flat = style(node);
      expect(flat.fontFamily).toBeUndefined();
      expect(flat.height).toBeUndefined();
      expect(flat.maxHeight).toBeUndefined();
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
    }
  });
});
