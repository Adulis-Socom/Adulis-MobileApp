import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { useBootstrap } from '../../../api/bootstrap';
import { ApiError, newIdempotencyKey, wasAnswered } from '../../../api/client';
import { failureMessage } from '../../../api/messages';
import { useSession } from '../../../auth/session';
import { cleanPhone, isE164, parseReturnTo, parseSaveNonce } from '../../../auth/sign-in-flow';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { useT } from '../../../i18n/i18n';

/**
 * Sign in, step 1 (ADU-MOB-02 v4.3 S70-S73): the phone number, then a code by SMS. Phone
 * only - no password, email or social sign-in. The request never says whether an Account
 * exists (the backend answers the same either way). One idempotency key per intent: a double
 * tap or a retry after a lost connection reuses it; a server answer or a different number
 * starts a new one.
 */
export default function SignIn() {
  const headerHeight = useHeaderHeight();
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; save?: string }>();
  const returnTo = parseReturnTo(params.returnTo);
  // A guest Save's continuation (WO-009 S16), passed on untouched: verify decides what it means.
  const save = parseSaveNonce(params.save);
  const { session, api, setOtpPhone } = useSession();
  const boot = useBootstrap();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const intent = useRef<{ phone: string; key: string } | null>(null);

  if (session.status === 'signedIn') return <Redirect href={returnTo} />;

  const send = async () => {
    const cleaned = cleanPhone(phone);
    if (!isE164(cleaned)) {
      setError(t('auth.phone.invalid'));
      return;
    }
    if (intent.current?.phone !== cleaned) intent.current = { phone: cleaned, key: newIdempotencyKey() };
    setError(null);
    setSending(true);
    try {
      // Until a bootstrap has succeeded the server may not have placed this device in its
      // market, and refuses an OTP for an unplaced device. The query registers first.
      if (boot.data === undefined) await boot.refetch({ throwOnError: true });
      await api.requestOtp(cleaned, intent.current.key);
      intent.current = null;
      setOtpPhone(cleaned);
      router.push({ pathname: '/auth/verify', params: { phone: cleaned, returnTo, ...(save ? { save } : {}) } });
    } catch (failure) {
      if (wasAnswered(failure)) intent.current = null;
      if (!(failure instanceof ApiError)) console.warn('[sign-in] request failed:', failure instanceof Error ? failure.message : 'unknown error');
      setError(failureMessage(t, failure));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // Measured from under the header (WO-017, B-008's pattern): the header's height is the offset.
      keyboardVerticalOffset={headerHeight}
    >
      <Screen edges={['bottom', 'left', 'right']}>
        <AppText>{t('auth.sign_in.intro')}</AppText>
        <TextField
          label={t('auth.phone.label')}
          hint={t('auth.phone.hint')}
          error={error}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (error) setError(null);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          editable={!sending}
        />
        <Button label={t('auth.send_code')} onPress={() => void send()} disabled={sending} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
