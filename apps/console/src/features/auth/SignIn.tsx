import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ErrorSummary, Field, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';
import { looksLikePhone, safeReturnPath, useAuthFlow } from './flow';

export function SignIn() {
  const session = useSession();
  const flow = useAuthFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(flow.phone);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const SignInHelper = session.selected.fixtureUi?.SignInHelper;
  const nav = location.state as { from?: unknown; justSignedOut?: boolean } | null;
  const setReturnTo = flow.setReturnTo;
  const from = safeReturnPath(nav?.from);
  useEffect(() => {
    if (from) setReturnTo(from);
  }, [from, setReturnTo]);

  const errors: FieldError[] = fieldError ? [{ fieldId: 'phone-input', message: fieldError }] : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    if (!looksLikePhone(phone)) {
      setFieldError(t('auth.phone.invalid'));
      setFocusToken((n) => n + 1);
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      const challenge = await session.selected.transport.send('auth.otp.start', { phone });
      flow.setPhone(phone);
      flow.setChallenge(challenge);
      void navigate('/sign-in/verify');
    } catch (error) {
      const e = asTransportError(error);
      if (e.code === 'VALIDATION_FAILED' && e.fields['phone']) {
        setFieldError(t('auth.phone.invalid'));
        setFocusToken((n) => n + 1);
      } else setProblem(e);
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title={t('auth.signin.title')}>{t('auth.signin.title')}</PageTitle>
      <p className="lead">{t('auth.signin.lead')}</p>
      {nav?.justSignedOut ? (
        <StatePanel kind="info" title={t('auth.signed_out_notice')} />
      ) : null}
      <ErrorSummary errors={errors} focusToken={focusToken} />
      <form onSubmit={(e) => void submit(e)} noValidate className="stack">
        <Field id="phone-input" label={t('auth.phone.label')} hint={t('auth.phone.hint')} error={fieldError}>
          {(control) => (
            <input
              {...control}
              className="text-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </Field>
        <Problem error={problem} />
        <div className="actions">
          <button type="submit" className="btn btn-highlight" aria-disabled={busy}>
            {busy ? t('auth.signin.sending') : t('auth.signin.submit')}
          </button>
          <Link className="btn btn-link" to="/sign-in/recovery">
            {t('auth.signin.recovery_link')}
          </Link>
        </div>
        <p role="status" className="sr-only">
          {busy ? t('auth.signin.sending') : ''}
        </p>
      </form>
      {SignInHelper ? <SignInHelper onPick={setPhone} /> : null}
    </>
  );
}
