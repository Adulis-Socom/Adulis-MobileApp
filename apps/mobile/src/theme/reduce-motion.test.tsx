import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './reduce-motion';

describe('useReduceMotion', () => {
  afterEach(() => jest.restoreAllMocks());

  it('follows the platform setting and its later changes, and stops listening on unmount', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, fn: (enabled: boolean) => void) => {
      if (name === 'reduceMotionChanged') listener = fn;
      return { remove };
    }) as never);
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await act(async () => undefined);
    expect(result.current).toBe(true);
    await act(async () => listener?.(false));
    expect(result.current).toBe(false);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('stays false when the platform cannot answer', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('unsupported'));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => undefined);
    expect(result.current).toBe(false);
  });
});
