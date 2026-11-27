// Sign-in, step two. Opens only for a challenge THIS run created (a link alone opens step one). One intent key per attempt,
// kept across retries. After a successful sign-in the person returns to an allowlisted destination rebuilt from validated parts.
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { t } from '../../../i18n/messages';
import { FALLBACK_RETURN, parseReturnTo, pathOf } from '../../../modes/routes';
import type { CodeChallenge } from '../../../contracts/gap-mob-session';
import { useApp } from '../../../providers/AppProvider';
import type { Runtime } from '../../../providers/runtime';
import { newIntentKey } from '../../../session/intent-key';
import { refusalText, SURFACE_REFUSAL_KEY } from '../../../ui/auth-text';
import { Body, Button, Field, Heading, Notice, Screen } from '../../../ui/components';

export default function Verify() {
  const { runtime } = useApp();
  const [, reread] = useState(0);
  useFocusEffect(useCallback(() => reread((n) => n + 1), [])); // a moved-to-front instance re-reads the current challenge
  const challenge = runtime?.challenge.get() ?? null;
  if (runtime === null || challenge === null) return <Redirect href="/auth/sign-in" />;
  // Keyed by the challenge: a reopened screen (this route is singular, so a second sign-in reuses the instance) starts a new
  // attempt with its own intent key and an empty code field, never the previous attempt's (M02-R02).
  return <VerifyForm key={challenge.ref} runtime={runtime} challenge={challenge} />;
}

function VerifyForm({ runtime, challenge }: { readonly runtime: Runtime; readonly challenge: CodeChallenge }) {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const intentKey = useRef(newIntentKey());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const verify = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const outcome = await runtime.session.verifyCode({ challenge, code, intentKey: intentKey.current });
    setBusy(false);
    if (outcome.kind === 'SIGNED_IN') {
      runtime.challenge.set(null);
      // No destination: Home. A destination that is not on the return allow-list: You (never the place the link named).
      const target = returnTo === undefined ? null : (parseReturnTo(returnTo) ?? FALLBACK_RETURN);
      router.replace(target ? pathOf(target) : '/home');
    } else if (outcome.kind === 'REFUSED') {
      setProblem(refusalText(outcome.refusal));
    } else if (outcome.kind === 'REJECTED_FOR_SURFACE') {
      setProblem(t(SURFACE_REFUSAL_KEY)); // the same sentence an unknown number gets: no hint about why
    }
  };

  return (
    <Screen>
      <Heading>{t('mobile.auth.verify.title')}</Heading>
      <Field label={t('mobile.auth.code.label')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" editable={!busy} />
      {busy ? <Notice text={t('mobile.auth.verifying')} /> : null}
      {problem ? <Notice tone="warn" text={problem} /> : null}
      <Button kind="highlight" label={t('mobile.auth.verify')} onPress={() => void verify()} disabled={code.trim() === ''} busy={busy} />
      <Button
        kind="secondary"
        label={t('mobile.auth.use_other_number')}
        onPress={() => {
          runtime.challenge.set(null);
          router.back();
        }}
      />
      <Body muted>{t('mobile.auth.recovery')}</Body>
    </Screen>
  );
}
