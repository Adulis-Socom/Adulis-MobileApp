// Helpers for mounted route tests: the REAL src/app tree booted through the real root layout and providers
// (expo-router/testing-library renderRouter, the pattern the archived Mobile suite used). Fixture mode is switched on per test
// with the same build-time expression the app uses; nothing here imports the fixtures.
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { t, type UiMessageKey } from '../i18n/messages';

export const APP_DIR = 'src/app';
export const WAIT = { timeout: 15_000 };

export function fixturesOn(on: boolean): void {
  if (on) process.env.EXPO_PUBLIC_ADULIS_FIXTURES = 'on';
  else delete process.env.EXPO_PUBLIC_ADULIS_FIXTURES;
}

export const boot = (initialUrl?: string) => renderRouter(APP_DIR, initialUrl === undefined ? {} : { initialUrl });

/** The stock bottom tab bar marks its items role "tab" on Android and "button" on iOS (jest-expo renders iOS). */
export const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
export const findText = (key: UiMessageKey, slots?: Readonly<Record<string, string | number>>) => screen.findByText(t(key, slots), undefined, WAIT);
export const findAllText = (key: UiMessageKey) => screen.findAllByText(t(key), undefined, WAIT);
export const button = (key: UiMessageKey, slots?: Readonly<Record<string, string | number>>) => screen.getByRole('button', { name: t(key, slots) });

/** Signs in through the real screens, from wherever a "Sign in" control is showing or from the sign-in screen itself. */
export async function signInThroughScreens(phone: string, code = '246810'): Promise<void> {
  const field = await screen.findByLabelText(t('mobile.auth.phone.label'), undefined, WAIT);
  await fireEvent.changeText(field, phone);
  await fireEvent.press(button('mobile.auth.send_code'));
  const codeField = await screen.findByLabelText(t('mobile.auth.code.label'), undefined, WAIT);
  await fireEvent.changeText(codeField, code);
  await fireEvent.press(button('mobile.auth.verify'));
}
