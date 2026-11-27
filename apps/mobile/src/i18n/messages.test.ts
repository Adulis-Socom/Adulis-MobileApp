// Server messages are catalogue KEYS: an unknown key never shows raw text, and slots are filled, never guessed.
import { hasKey, serverText, t } from './messages';
import { provisionalEn } from './provisional';

describe('messages', () => {
  it('prefers the shared catalogue and falls back to the registered provisional text', () => {
    expect(t('error.request.internal')).toBe('Something went wrong on our side. Please try again.');
    expect(t('mobile.tab.home')).toBe('Home');
  });

  it('shows the fallback, never raw server text, for an unknown or non-key message', () => {
    expect(serverText({ key: 'totally.unknown' }, 'mobile.auth.refused.generic')).toBe(t('mobile.auth.refused.generic'));
    expect(serverText(null, 'mobile.state.empty')).toBe(t('mobile.state.empty'));
    expect(hasKey('<script>')).toBe(false);
  });

  it('fills named slots and leaves an unknown slot visible', () => {
    expect(t('mobile.mode.switch_to', { mode: 'Courier' })).toBe('Switch to Courier');
    expect(t('mobile.mode.switch_to', {})).toBe('Switch to {mode}');
  });

  it('keeps every provisional key a whole ASCII sentence with named slots only (the shared catalogue rules)', () => {
    for (const [key, text] of Object.entries(provisionalEn)) {
      expect(key.startsWith('mobile.')).toBe(true);
      expect(text).toMatch(/^[\x20-\x7e]+$/);
      expect(text.replace(/\{[A-Za-z0-9_]+\}/g, '')).not.toMatch(/[{}]/);
    }
  });
});
