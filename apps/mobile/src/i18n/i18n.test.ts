import { am, en, type MobileMessageKey } from '@adulis/locale/mobile';
import { renderHook } from '@testing-library/react-native';

import { useUiStore } from '../state/ui-store';
import { amharicAvailable, translate, useT } from './i18n';

describe('mobile catalogue', () => {
  it('resolves every mobile key to a real string in both languages', () => {
    for (const key of Object.keys(en) as MobileMessageKey[]) {
      expect(translate('en', key).trim()).not.toBe('');
      expect(translate('am', key).trim()).not.toBe('');
    }
  });

  it('serves the selected locale', async () => {
    useUiStore.setState({ locale: 'am' });
    const amharic = await renderHook(() => useT());
    expect(amharic.result.current('common.retry')).toBe(am['common.retry']);

    useUiStore.setState({ locale: 'en' });
    const english = await renderHook(() => useT());
    expect(english.result.current('common.retry')).toBe(en['common.retry']);
  });

  it('serves English in a release build whatever the store holds (Amharic is not reviewed)', async () => {
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    useUiStore.setState({ locale: 'am' });
    try {
      expect(amharicAvailable()).toBe(false);
      const release = await renderHook(() => useT());
      expect(release.result.current('buyer.tab.home')).toBe(en['buyer.tab.home']);
    } finally {
      devGlobal.__DEV__ = dev;
      useUiStore.setState({ locale: 'en' });
    }
  });
});
