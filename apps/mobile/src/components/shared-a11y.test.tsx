import { am, en } from '@adulis/locale/mobile';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { themes } from '../theme/theme';
import { Button } from './Button';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorState } from './ErrorState';
import { Loading } from './Loading';
import { Placeholder } from './Placeholder';
import { Screen } from './Screen';
import { TextField } from './TextField';
import { UpgradeRequired } from './UpgradeRequired';

/**
 * Screen-reader roles, labels, states and announcements of the shared components (the ones
 * Checkbox, Button, StatusText and the focus hook are covered in a11y-states.test.tsx), and that
 * a state is never carried by colour alone.
 */

const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const noop = () => undefined;

beforeEach(() => useUiStore.setState({ themePreference: 'light', locale: 'en' }));
afterEach(() => act(() => useUiStore.setState({ themePreference: 'system', locale: 'en' })));

describe('TextField', () => {
  it('names the input by its visible label and carries the hint as its accessibility hint', async () => {
    await render(<TextField label="Phone number" hint="Use your own number" value="" onChangeText={noop} />);
    const input = screen.getByLabelText('Phone number');
    expect(input.props.accessibilityHint).toBe('Use your own number');
    expect(screen.getByText('Phone number')).toBeOnTheScreen();
    expect(screen.getByText('Use your own number')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error as an alert in words with a thicker border, and announces each new error once', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const view = await render(<TextField label="Phone" value="" onChangeText={noop} />);
      expect(announce).not.toHaveBeenCalled();
      const idle = flat(screen.getByLabelText('Phone'));

      await view.rerender(<TextField label="Phone" error="Enter a valid number" value="" onChangeText={noop} />);
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid number');
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenLastCalledWith('Enter a valid number');
      const failed = flat(screen.getByLabelText('Phone'));
      expect(failed.borderWidth).toBeGreaterThan(idle.borderWidth as number);
      expect(failed.borderColor).toBe(themes.light.color.danger);

      // The same error again says nothing more; a different one is announced.
      await view.rerender(<TextField label="Phone" error="Enter a valid number" value="1" onChangeText={noop} />);
      expect(announce).toHaveBeenCalledTimes(1);
      await view.rerender(<TextField label="Phone" error="Too many digits" value="1" onChangeText={noop} />);
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith('Too many digits');

      await view.rerender(<TextField label="Phone" error={null} value="1" onChangeText={noop} />);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(announce).toHaveBeenCalledTimes(2);
    } finally {
      announce.mockRestore();
    }
  });
});

describe('ChoiceGroup', () => {
  const options = [
    { value: 'en', label: 'English' },
    { value: 'am', label: 'Amharic' },
  ] as const;

  it('is a labelled radio group whose options say checked in state, and the choice changes on press', async () => {
    const onChange = jest.fn();
    const view = await render(<ChoiceGroup label="Language" value="en" onChange={onChange} options={options} />);
    // The group is a container, not one stop: its options stay individually reachable.
    const group = screen.getByLabelText('Language');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessible).not.toBe(true);
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Amharic' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Amharic' }));
    expect(onChange).toHaveBeenCalledWith('am');
    await view.rerender(<ChoiceGroup label="Language" value="am" onChange={onChange} options={options} />);
    expect(screen.getByRole('radio', { name: 'Amharic' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked();
  });

  it('marks the selected option without colour: a check mark in its text, a thicker border and a heavier weight', async () => {
    await render(<ChoiceGroup label="Language" value="en" onChange={noop} options={options} />);
    const selected = screen.getByRole('radio', { name: 'English' });
    const other = screen.getByRole('radio', { name: 'Amharic' });
    expect(screen.getByText(/English/).props.children).toMatch(/^.+ English$/);
    expect(screen.getByText('Amharic')).toBeOnTheScreen();
    expect(flat(selected).borderWidth).toBeGreaterThan(flat(other).borderWidth as number);
    expect(flat(screen.getByText(/English/)).fontWeight).toBe(themes.light.fontWeight.semibold);
    expect(flat(screen.getByText('Amharic')).fontWeight).toBe(themes.light.fontWeight.regular);
  });
});

describe('Button', () => {
  it('draws the quieter action with an outline, not only a different colour', async () => {
    await render(
      <>
        <Button label="Continue" onPress={noop} />
        <Button label="Resend" variant="secondary" onPress={noop} />
      </>,
    );
    expect(flat(screen.getByRole('button', { name: 'Continue' })).borderWidth).toBeUndefined();
    expect(flat(screen.getByRole('button', { name: 'Resend' })).borderWidth).toBe(1);
  });

  it('exposes a disabled button as disabled and ignores its press', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Loading', () => {
  it.each([
    ['en', en['common.loading']],
    ['am', am['common.loading']],
  ] as const)('labels the spinner for a screen reader in the selected language (%s)', async (locale, label) => {
    useUiStore.setState({ locale });
    await render(<Loading />);
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });
});

describe('Screen', () => {
  it('announces its title as a heading, once, above its content', async () => {
    await render(
      <Screen title="Your orders">
        <Placeholder message="Nothing to show yet" />
      </Screen>,
    );
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(screen.getByRole('header')).toHaveTextContent('Your orders');
    expect(screen.getByText('Nothing to show yet')).toBeOnTheScreen();
  });

  it('has no heading when it has no title', async () => {
    await render(
      <Screen>
        <Placeholder message="Nothing to show yet" />
      </Screen>,
    );
    expect(screen.queryByRole('header')).toBeNull();
  });
});

describe('the whole-screen states', () => {
  it('ErrorState speaks its message as an alert, announces it, and offers Retry', async () => {
    const retry = jest.fn();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      await render(<ErrorState retry={retry} />);
      expect(screen.getByRole('alert')).toHaveTextContent(en['error.request.internal']);
      expect(announce).toHaveBeenCalledWith(en['error.request.internal']);
      await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      announce.mockRestore();
    }
  });

  it('UpgradeRequired has a heading, a body and one action that is disabled while it checks', async () => {
    const onCheckAgain = jest.fn();
    const view = await render(<UpgradeRequired onCheckAgain={onCheckAgain} checking={false} />);
    expect(screen.getByRole('header')).toHaveTextContent(en['app.upgrade.required.title']);
    expect(screen.getByText(en['app.upgrade.required.body'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['app.upgrade.check_again'] }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
    await view.rerender(<UpgradeRequired onCheckAgain={onCheckAgain} checking />);
    expect(screen.getByRole('button', { name: en['app.upgrade.check_again'] })).toBeDisabled();
  });
});
