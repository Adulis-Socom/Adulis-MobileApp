import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { AccessibilityInfo, Text, type HostInstance } from 'react-native';

import { StatusText } from './AlertText';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { FOCUS_DELAY_MS, useFocusRequest } from './focus';

/** WO-018 (A-006): busy and disabled states are announced, not only drawn; focus requests land once. */
describe('Checkbox', () => {
  it('exposes checked, disabled and busy, and ignores taps while disabled or busy', async () => {
    const onChange = jest.fn();
    const view = await render(<Checkbox label="Gifts" checked={false} onChange={onChange} />);
    const box = () => screen.getByRole('checkbox', { name: 'Gifts' });
    expect(box()).not.toBeChecked();
    expect(box()).toBeEnabled();
    expect(box()).not.toBeBusy();
    await fireEvent.press(box());
    expect(onChange).toHaveBeenLastCalledWith(true);

    // Another Collection's change is in flight: this box is disabled, not busy.
    await view.rerender(<Checkbox label="Gifts" checked onChange={onChange} disabled />);
    expect(box()).toBeChecked();
    expect(box()).toBeDisabled();
    expect(box()).not.toBeBusy();
    await fireEvent.press(box());
    expect(onChange).toHaveBeenCalledTimes(1);

    // This box's own change is in flight: busy, and so disabled too.
    await view.rerender(<Checkbox label="Gifts" checked onChange={onChange} busy />);
    expect(box()).toBeBusy();
    expect(box()).toBeDisabled();
    await fireEvent.press(box());
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Button', () => {
  it('a busy button is announced as busy and disabled; an ordinary one carries no busy state', async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Load more" onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Load more' }).props.accessibilityState).toEqual({ disabled: false });
    await view.rerender(<Button label="Load more" onPress={onPress} disabled busy />);
    const button = screen.getByRole('button', { name: 'Load more' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('StatusText', () => {
  it('announces its line when it appears and changes, without the alert role', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const view = await render(<StatusText>Loading more</StatusText>);
      expect(screen.getByText('Loading more')).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(announce).toHaveBeenCalledWith('Loading more');
      await view.rerender(<StatusText>{null}</StatusText>);
      expect(screen.queryByText('Loading more')).toBeNull();
      expect(announce).toHaveBeenCalledTimes(1);
    } finally {
      announce.mockRestore();
    }
  });
});

describe('useFocusRequest', () => {
  function Target({ request }: { request: string | number | null }) {
    const ref = useRef<HostInstance>(null);
    useFocusRequest(ref, request);
    return <Text ref={ref}>Step heading</Text>;
  }
  const focusedText = (call: unknown[]) => (call[0] as { props: { children: unknown } }).props.children;

  it('focuses the element after a short delay for each new request, and never without one', async () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => undefined);
    try {
      const view = await render(<Target request={null} />);
      await act(() => jest.advanceTimersByTimeAsync(FOCUS_DELAY_MS * 4));
      expect(focus).not.toHaveBeenCalled();

      await view.rerender(<Target request="phone" />);
      expect(focus).not.toHaveBeenCalled(); // not before the view can reach the screen reader
      await act(() => jest.advanceTimersByTimeAsync(FOCUS_DELAY_MS));
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus.mock.calls[0]![1]).toBe('focus');
      expect(focusedText(focus.mock.calls[0]!)).toBe('Step heading');

      // The same request again moves nothing; a new one does.
      await view.rerender(<Target request="phone" />);
      await act(() => jest.advanceTimersByTimeAsync(FOCUS_DELAY_MS * 4));
      expect(focus).toHaveBeenCalledTimes(1);
      await view.rerender(<Target request="code" />);
      await act(() => jest.advanceTimersByTimeAsync(FOCUS_DELAY_MS));
      expect(focus).toHaveBeenCalledTimes(2);

      // A request whose element goes before the delay is dropped.
      await view.rerender(<Target request="preview" />);
      await view.unmount();
      await act(() => jest.advanceTimersByTimeAsync(FOCUS_DELAY_MS * 4));
      expect(focus).toHaveBeenCalledTimes(2);
    } finally {
      focus.mockRestore();
      jest.useRealTimers();
    }
  });
});
