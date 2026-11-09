import { useRouter } from 'expo-router';

import type { ReturnTo } from '../auth/sign-in-flow';
import { Button } from '../components/Button';
import { Placeholder } from '../components/Placeholder';
import { useT } from '../i18n/i18n';

/**
 * What a guest sees on an account-bound destination (ADU-MOB-02 v4.3 S11, S39, S72): the
 * reason, and a Sign in action that returns here when done. Opening the destination never
 * starts sign-in by itself; the Buyer chooses it. Nothing about an Account is fabricated.
 */
export function SignInRequired({ message, returnTo }: { message: string; returnTo: ReturnTo }) {
  const t = useT();
  const router = useRouter();
  return (
    <>
      <Placeholder message={message} />
      <Button
        label={t('auth.sign_in')}
        onPress={() => router.push({ pathname: '/auth/sign-in', params: { returnTo } })}
      />
    </>
  );
}
