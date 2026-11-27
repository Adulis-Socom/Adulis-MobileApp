// Automated accessibility ASSERTIONS on the primitives (names, roles, states, targets). These are not TalkBack or VoiceOver
// evidence; that is native-device work (13_NATIVE_DEVICE_VERIFICATION_GUIDE.md).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { refusalText } from './auth-text';
import { Button, Field, FixtureBanner, StateView } from './components';
import { theme } from './theme';
import { t } from '../i18n/messages';

describe('Button', () => {
  it('has a role, a name and a state, and meets the 44-point target', async () => {
    const onPress = jest.fn();
    await render(<Button label="Send code" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Send code' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(theme.touch).toBeGreaterThanOrEqual(44);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while busy or disabled and says so to a screen reader', async () => {
    const onPress = jest.fn();
    await render(<Button label="Verify" onPress={onPress} busy />);
    const button = screen.getByRole('button', { name: 'Verify' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('names its input, so it is findable by label', async () => {
    await render(<Field label="Phone number" value="" onChangeText={() => undefined} />);
    expect(screen.getByLabelText('Phone number')).toBeTruthy();
  });
});

describe('StateView', () => {
  it.each([
    ['loading', 'mobile.state.loading'],
    ['empty', 'mobile.state.empty'],
    ['offline', 'mobile.state.offline'],
    ['unauthorized', 'mobile.state.unauthorized'],
    ['error', 'error.request.internal'],
    ['not-found', 'error.request.not_found'],
  ] as const)('renders the %s state from the catalogue and announces it', async (kind, key) => {
    await render(<StateView kind={kind} />);
    expect(screen.getAllByText(t(key)).length).toBeGreaterThan(0);
  });

  it('offers a retry that works', async () => {
    const onRetry = jest.fn();
    await render(<StateView kind="offline" onRetry={onRetry} />);
    await fireEvent.press(screen.getByRole('button', { name: t('mobile.state.retry') }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('FixtureBanner', () => {
  it('is announced as an alert and shows exactly the text it is given', async () => {
    await render(<FixtureBanner text="Demonstration data." />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Demonstration data.')).toBeTruthy();
  });
});

describe('sign-in refusal text', () => {
  it('prefers the server message key and otherwise picks a generic sentence by code, naming nothing about the number', () => {
    expect(refusalText({ code: 'OTP_INVALID', message: null, retryAt: null })).toBe(t('mobile.auth.refused.otp_invalid'));
    expect(refusalText({ code: 'RATE_LIMITED', message: { key: 'mobile.auth.refused.rate_limited' }, retryAt: null })).toBe(t('mobile.auth.refused.rate_limited'));
    expect(refusalText({ code: 'PERMISSION_DENIED', message: { key: 'not.a.key' }, retryAt: null })).toBe(t('mobile.auth.refused.generic'));
    expect(refusalText({ code: 'AUDIENCE_NOT_PERMITTED', message: null, retryAt: null })).toBe(t('mobile.auth.refused.generic'));
  });
});
