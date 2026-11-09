import { Placeholder } from '../components/Placeholder';
import { useT } from '../i18n/i18n';

/**
 * What a guest sees on an account-bound destination (ADU-MOB-02 v4.3 S11, S39): the
 * reason, and an honest note that sign-in is not in this build yet. It never opens OTP by
 * itself and never fabricates an Account or account data.
 */
export function SignInRequired({ message }: { message: string }) {
  const t = useT();
  return <Placeholder message={message} note={t('buyer.sign_in.coming')} />;
}
