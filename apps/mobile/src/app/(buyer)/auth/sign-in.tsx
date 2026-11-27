// Sign-in, step one: ask for a code. User-initiated only (a link cannot make the app send one). The field is NOT validated
// for shape, length or country: that would be inventing authentication policy; the server decides and the app shows what it said.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { t } from '../../../i18n/messages';
import { useApp } from '../../../providers/AppProvider';
import { Body, Button, Field, Heading, Notice, Screen } from '../../../ui/components';
import { refusalText } from '../../../ui/auth-text';

export default function SignIn() {
  const { runtime } = useApp();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    if (runtime === null || busy) return;
    setBusy(true);
    setProblem(null);
    const outcome = await runtime.session.requestCode({ destination });
    setBusy(false);
    if (outcome.kind === 'SENT') {
      runtime.challenge.set(outcome.challenge);
      router.push(returnTo ? `/auth/verify?returnTo=${encodeURIComponent(returnTo)}` : '/auth/verify');
    } else if (outcome.kind === 'REFUSED') {
      setProblem(refusalText(outcome.refusal));
    }
  };

  return (
    <Screen>
      <Heading>{t('mobile.auth.sign_in.title')}</Heading>
      <Field label={t('mobile.auth.phone.label')} value={destination} onChangeText={setDestination} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!busy} />
      {busy ? <Notice text={t('mobile.auth.sending')} /> : null}
      {problem ? <Notice tone="warn" text={problem} /> : null}
      <Button kind="highlight" label={t('mobile.auth.send_code')} onPress={() => void send()} disabled={destination.trim() === ''} busy={busy} />
      <Body muted>{t('mobile.auth.recovery')}</Body>
    </Screen>
  );
}
