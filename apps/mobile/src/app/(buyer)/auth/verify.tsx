import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform } from 'react-native';

import { ApiError, newIdempotencyKey, problemCode, wasAnswered, type OtpVerifyBody } from '../../../api/client';
import { failureMessage, fillSlots } from '../../../api/messages';
import { useSession } from '../../../auth/session';
import { isOtpCode, parseReturnTo, parseSaveNonce } from '../../../auth/sign-in-flow';
import { completePendingSave } from '../../../buyer/saved';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Checkbox } from '../../../components/Checkbox';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { useT } from '../../../i18n/i18n';
import { useTheme } from '../../../theme/theme';

/**
 * Sign in, step 2: the six-digit code from the SMS.
 *
 * - Age: an over-18 declaration is asked ONLY when the server answers
 *   AGE_DECLARATION_REQUIRED, i.e. when this phone would create a new Account (ADU-AUTH-02;
 *   AUTH-01 S13). It is a declaration, never a date of birth, and its sentence is the
 *   HUMAN-REQUIRED catalogue text. An existing Account is never asked.
 * - Resend: a NEW code that supersedes the old (the server's backoff applies). No countdown:
 *   the contract exposes no timing, so a refusal shows the server's own message and slots.
 * - Idempotency: one key per intent (this code, this declaration). A double tap or a retry
 *   after a lost connection reuses it; a server answer, or a changed code or declaration,
 *   starts a new one.
 * - The code is never logged, stored or shown back.
 */
export default function Verify() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; returnTo?: string; save?: string }>();
  const returnTo = parseReturnTo(params.returnTo);
  const save = parseSaveNonce(params.save);
  const queryClient = useQueryClient();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const navigation = useNavigation();
  const { session, api, boundApi, deviceId, signIn, otpPhone, setOtpPhone } = useSession();
  const [code, setCode] = useState('');
  const [needsAge, setNeedsAge] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from the code's error: a missing declaration must not mark a good code as wrong.
  const [ageError, setAgeError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const intent = useRef<{ signature: string; key: string } | null>(null);
  const completing = useRef(false);

  // A message that appears away from the focused control is spoken; the alert role alone is not.
  const ageMessage = t('error.auth.age_declaration_required');
  useEffect(() => {
    if (ageError) AccessibilityInfo.announceForAccessibility(ageMessage);
  }, [ageError, ageMessage]);
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
  // The code flow ends whenever this screen loses focus in the navigator (Back, a tab link, a
  // notification, anything opened on top, sign-in); the app going to the background is not a
  // blur, so reading the SMS keeps it. A navigation event, not an unmount cleanup, so a
  // StrictMode remount keeps it. The navigator can emit blur after this screen's cleanup has
  // run, so unsubscribing waits a microtask (the pattern the router documents for 'removed').
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => setOtpPhone(null));
    return () => queueMicrotask(unsubscribe);
  }, [navigation, setOtpPhone]);

  if (session.status === 'signedIn' && !completing.current) return <Redirect href={returnTo} />;
  // Only for a code this app run asked for: a phone in a link (cold or not) is no proof, so a
  // link alone never shows the form or reaches Send a new code. The form stays while signing in.
  if (otpPhone !== phone && !completing.current) {
    return <Redirect href={{ pathname: '/auth/sign-in', params: { returnTo, ...(save ? { save } : {}) } }} />;
  }

  const verify = async () => {
    if (!isOtpCode(code)) {
      setError(t('auth.code.invalid'));
      return;
    }
    if (needsAge && !ageConfirmed) {
      setAgeError(true);
      return;
    }
    const signature = `${code}|${needsAge ? String(ageConfirmed) : '-'}`;
    if (intent.current?.signature !== signature) intent.current = { signature, key: newIdempotencyKey() };
    setError(null);
    setNotice(null);
    setBusy('verify');
    try {
      const body: OtpVerifyBody = {
        phone,
        code,
        device_id: await deviceId(),
        ...(needsAge ? { age_declared_over_18: ageConfirmed } : {}),
      };
      const verified = await api.verifyOtp(body, intent.current.key);
      // A MOBILE sign-in always carries the bearer; without one there is nothing to keep.
      if (!verified.token) throw new Error('verify answered without a credential');
      completing.current = true;
      await signIn(verified.token);
      AccessibilityInfo.announceForAccessibility(t('auth.signed_in'));
      // The guest's Save, bound to the credential this sign-in returned (WO-009A S9): it re-checks
      // the target, sends nothing once that session ends, and never blocks the return. Any other
      // armed Save (a cancelled sign-in) is dropped here.
      void completePendingSave(boundApi(verified.token), queryClient, save);
      router.dismissTo(returnTo);
    } catch (failure) {
      completing.current = false;
      if (wasAnswered(failure)) intent.current = null;
      if (!(failure instanceof ApiError)) {
        console.warn('[verify] sign-in failed:', failure instanceof Error ? failure.message : 'unknown error');
      }
      if (problemCode(failure) === 'AGE_DECLARATION_REQUIRED') {
        setNeedsAge(true);
        setAgeError(true);
      } else {
        setError(failureMessage(t, failure));
      }
      setBusy(null);
    }
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    setBusy('resend');
    try {
      await api.resendOtp(phone);
      intent.current = null;
      setCode('');
      setNotice(t('auth.code.resent'));
    } catch (failure) {
      setError(failureMessage(t, failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom', 'left', 'right']}>
        <AppText>{fillSlots(t('auth.verify.sent_to'), { phone }) ?? ''}</AppText>
        <TextField
          label={t('auth.code.label')}
          error={error}
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, 6));
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={() => void verify()}
          editable={busy === null}
        />
        {needsAge ? (
          <Checkbox
            label={t('auth.age.declaration')}
            checked={ageConfirmed}
            onChange={(checked) => {
              setAgeConfirmed(checked);
              setAgeError(false);
            }}
          />
        ) : null}
        {ageError ? (
          <AppText accessibilityRole="alert" style={{ color: theme.color.danger }}>
            {ageMessage}
          </AppText>
        ) : null}
        {notice ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.color.textSecondary }}>
            {notice}
          </AppText>
        ) : null}
        <Button label={t('auth.verify')} onPress={() => void verify()} disabled={busy !== null} />
        <Button label={t('auth.resend')} onPress={() => void resend()} disabled={busy !== null} variant="secondary" />
        <Button label={t('auth.change_number')} onPress={() => router.back()} disabled={busy !== null} variant="secondary" />
      </Screen>
    </KeyboardAvoidingView>
  );
}
