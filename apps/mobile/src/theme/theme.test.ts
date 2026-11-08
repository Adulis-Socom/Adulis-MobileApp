import { colorDark } from '@adulis/tokens';
import { renderHook } from '@testing-library/react-native';

import { useUiStore } from '../state/ui-store';
import { resolveColorMode, themes, toDp, useTheme } from './theme';

describe('token adapter', () => {
  it('converts rem and px token lengths to dp', () => {
    expect(toDp('1rem')).toBe(16);
    expect(toDp('0.8125rem')).toBe(13);
    expect(toDp('44px')).toBe(44);
  });

  it('rejects a length it cannot convert instead of guessing', () => {
    expect(() => toDp('1em')).toThrow('has no dp conversion');
  });

  it('carries the 44dp touch target and the token spacing scale', () => {
    expect(themes.light.touchTarget).toBe(44);
    expect(themes.light.space.md).toBe(16);
  });
});

describe('theme selection', () => {
  it.each([
    ['system', 'dark', 'dark'],
    ['system', 'light', 'light'],
    ['system', null, 'light'],
    ['system', undefined, 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)('preference %s with system %s resolves to %s', (preference, system, expected) => {
    expect(resolveColorMode(preference, system)).toBe(expected);
  });

  it('serves the theme for the stored preference to every screen', async () => {
    useUiStore.setState({ themePreference: 'dark' });
    const dark = await renderHook(() => useTheme());
    expect(dark.result.current).toBe(themes.dark);

    useUiStore.setState({ themePreference: 'light' });
    const light = await renderHook(() => useTheme());
    expect(light.result.current).toBe(themes.light);
  });

  it('takes both modes from @adulis/tokens under identical role names, never a copy', () => {
    expect(themes.dark.color).toBe(colorDark);
    expect(Object.keys(themes.dark.color).sort()).toEqual(Object.keys(themes.light.color).sort());
  });
});
