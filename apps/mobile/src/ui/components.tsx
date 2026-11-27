// The small set of primitives MOB-FE-01 needs. Values come from the token adapter; strings come from the catalogue; every
// interactive element has an accessible name, role and state and a 44-point minimum target, and no text container fixes a height.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t, type UiMessageKey } from '../i18n/messages';
import { theme } from './theme';

/** The persistent demonstration banner. Fixture-only text: it is passed in, never read from the catalogue. */
export function FixtureBanner({ text }: { readonly text: string }) {
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

/** The shared screen primitive: safe area, page colour, and the banner slot (native modal presentations cover root views). */
export function Screen({ children, banner }: { readonly children: ReactNode; readonly banner?: string | null }) {
  return (
    <SafeAreaView style={styles.screen}>
      {banner ? <FixtureBanner text={banner} /> : null}
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

export function Heading({ children }: { readonly children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { readonly children: ReactNode; readonly muted?: boolean }) {
  return <Text style={muted ? styles.muted : styles.body}>{children}</Text>;
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly kind?: 'primary' | 'secondary';
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly selected?: boolean;
  readonly testID?: string;
}

export function Button({ label, onPress, kind = 'primary', disabled = false, busy = false, selected, testID }: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy, ...(selected === undefined ? {} : { selected }) }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, kind === 'primary' ? styles.primary : styles.secondary, inactive && styles.inactive, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, kind === 'primary' ? styles.primaryText : styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: { readonly label: string } & Omit<TextInputProps, 'accessibilityLabel' | 'style'>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={theme.color.textMuted} style={styles.input} {...input} />
    </View>
  );
}

export type StateKind = 'loading' | 'empty' | 'offline' | 'error' | 'unauthorized' | 'not-found';

const STATE_TEXT: Record<StateKind, UiMessageKey> = {
  loading: 'mobile.state.loading',
  empty: 'mobile.state.empty',
  offline: 'mobile.state.offline',
  error: 'error.request.internal',
  unauthorized: 'mobile.state.unauthorized',
  'not-found': 'error.request.not_found',
};

/** Loading, empty, offline, error, unauthorized and unsupported-route states, one component, announced to a screen reader. */
export function StateView({ kind, message, onRetry, action }: { readonly kind: StateKind; readonly message?: string; readonly onRetry?: () => void; readonly action?: { readonly label: string; readonly onPress: () => void } }) {
  const text = message ?? t(STATE_TEXT[kind]);
  return (
    <View style={styles.state} accessibilityLiveRegion="polite" accessibilityRole={kind === 'error' || kind === 'offline' ? 'alert' : undefined}>
      {kind === 'loading' ? <ActivityIndicator accessibilityLabel={text} color={theme.color.primary} /> : null}
      <Text style={styles.stateText}>{text}</Text>
      {onRetry ? <Button kind="secondary" label={t('mobile.state.retry')} onPress={onRetry} /> : null}
      {action ? <Button kind="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/** A one-line notice above content (offline, session ended, upgrade recommended). */
export function Notice({ text, tone = 'info' }: { readonly text: string; readonly tone?: 'info' | 'warn' }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.notice, tone === 'warn' ? styles.noticeWarn : styles.noticeInfo]}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  content: { flex: 1, padding: theme.space.md, gap: theme.space.md },
  banner: { backgroundColor: theme.color.highlight, borderBottomWidth: 1, borderColor: theme.color.highlightBorder, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  bannerText: { ...theme.text.small, color: theme.color.highlightText, fontWeight: '600' },
  heading: { ...theme.text.title, color: theme.color.text },
  body: { ...theme.text.body, color: theme.color.text },
  muted: { ...theme.text.body, color: theme.color.textMuted },
  button: { minHeight: theme.touch, minWidth: theme.touch, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, paddingVertical: theme.space.smd, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: theme.color.primary },
  secondary: { backgroundColor: theme.color.secondary, borderWidth: 1, borderColor: theme.color.borderStrong },
  inactive: { opacity: 0.6 },
  pressed: { backgroundColor: theme.color.primaryActive },
  buttonText: { ...theme.text.body, fontWeight: '600' },
  primaryText: { color: theme.color.primaryText },
  secondaryText: { color: theme.color.secondaryText },
  field: { gap: theme.space.xs },
  label: { ...theme.text.small, color: theme.color.textSecondary },
  input: { ...theme.text.body, minHeight: theme.touch, borderWidth: 1, borderColor: theme.color.borderStrong, borderRadius: theme.radius.md, paddingHorizontal: theme.space.smd, backgroundColor: theme.color.surface, color: theme.color.text },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.md, padding: theme.space.lg },
  stateText: { ...theme.text.body, color: theme.color.textSecondary, textAlign: 'center' },
  notice: { padding: theme.space.smd, borderRadius: theme.radius.md, borderWidth: 1 },
  noticeInfo: { backgroundColor: theme.color.infoBg, borderColor: theme.color.infoBorder },
  noticeWarn: { backgroundColor: theme.color.warnBg, borderColor: theme.color.warnBorder },
  noticeText: { ...theme.text.small, color: theme.color.text },
});
