import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { OtpStatus } from '../../contracts/gap-sc';
import { ErrorSummary, Field, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { formatClock, t } from '../../i18n/t';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';
import { problemText } from '../problem';
import { useAuthFlow } from './flow';

/**
 * The server's clock is the only clock that matters here. Deadlines arrive as absolute instants with the server's own
 * `server_time`; we display them and, when one passes, ASK the server what is now true (resend allowed? expired?).
 * We never enable or disable anything because our own clock reached a number.
 */
function useDeadlineRefetch(status: OtpStatus | null, refetch: () => void): void {
  useEffect(() => {
    if (!status) return;
    const offset = Date.parse(status.server_time) - Date.now();
    const serverNow = () => Date.now() + offset;
    const upcoming = [status.resend_available_at, status.expires_at].map((iso) => Date.parse(iso) - serverNow()).filter((ms) => ms > 0);
    if (upcoming.length === 0) return;
    const timer = setTimeout(refetch, Math.min(...upcoming) + 50);
    return () => clearTimeout(timer);
  }, [status, refetch]);
}

export function Verify() {
  const session = useSession();
  const flow = useAuthFlow();
  const navigate = useNavigate();
  const { transport } = session.selected;
  const challenge = flow.challenge;
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const [notice, setNotice] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const [status, setStatus] = useState<OtpStatus | null>(
    challenge ? { state: 'PENDING', server_time: challenge.server_time, expires_at: challenge.expires_at, resend_available_at: challenge.resend_available_at, resend_allowed: false } : null,
  );
  const challengeId = challenge?.challenge_id;
  const setChallenge = flow.setChallenge;

  const refetch = useCallback(() => {
    if (!challengeId) return;
    transport
      .send('auth.otp.status', { challenge_id: challengeId })
      .then(setStatus)
      .catch((error: unknown) => setProblem(asTransportError(error)));
  }, [transport, challengeId]);
  useDeadlineRefetch(status, refetch);

  if (!challenge || !status) return <Navigate to="/sign-in" replace />;
  const errors: FieldError[] = fieldError ? [{ fieldId: 'code-input', message: fieldError }] : [];
  const expired = status.state !== 'PENDING';

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !challenge) return;
    setProblem(null);
    setNotice(false);
    const trimmed = code.trim();
    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      setFieldError(trimmed === '' ? t('auth.code.required') : t('auth.code.digits'));
      setFocusToken((n) => n + 1);
      return;
    }
    setFieldError(undefined);
    setBusy('verify');
    try {
      const result = await transport.send('auth.otp.verify', { challenge_id: challenge.challenge_id, code: trimmed });
      if (result.result === 'DECLARATIONS_REQUIRED') {
        flow.setPolicyVersion(result.policy_version);
        void navigate('/sign-in/declarations');
        return;
      }
      // Signed in: the session boundary re-asks the server, and the auth gate then sends the person on.
      await session.refresh();
      setBusy(null);
    } catch (error) {
      const e = asTransportError(error);
      if (e.code === 'OTP_INVALID' || e.code === 'OTP_EXPIRED') {
        setFieldError(problemText(e));
        setFocusToken((n) => n + 1);
        if (e.code === 'OTP_EXPIRED') refetch();
      } else setProblem(e);
      setBusy(null);
    }
  }

  async function resend() {
    if (busy || !challenge) return;
    setProblem(null);
    setFieldError(undefined);
    setBusy('resend');
    try {
      const next = await transport.send('auth.otp.resend', { challenge_id: challenge.challenge_id });
      setChallenge(next);
      setStatus({ state: 'PENDING', server_time: next.server_time, expires_at: next.expires_at, resend_available_at: next.resend_available_at, resend_allowed: false });
      setCode('');
      setNotice(true);
    } catch (error) {
      setProblem(asTransportError(error));
    }
    setBusy(null);
  }

  return (
    <>
      <PageTitle title={t('auth.verify.title')}>{t('auth.verify.title')}</PageTitle>
      <p className="lead">{t('auth.verify.lead', { phone: flow.phone })}</p>
      <ErrorSummary errors={errors} focusToken={focusToken} />
      <form onSubmit={(e) => void verify(e)} noValidate className="stack">
        <Field id="code-input" label={t('auth.code.label')} hint={t('auth.code.hint')} error={fieldError}>
          {(control) => (
            <input
              {...control}
              className="text-input code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
        </Field>
        {expired ? null : <p className="hint">{t('auth.verify.expires', { time: formatClock(status.expires_at) })}</p>}
        <Problem error={problem} />
        <div className="actions">
          <button type="submit" className="btn btn-highlight" aria-disabled={busy !== null}>
            {busy === 'verify' ? t('auth.verify.checking') : t('auth.verify.submit')}
          </button>
        </div>
        <p role="status" className="sr-only">
          {busy === 'verify' ? t('auth.verify.checking') : busy === 'resend' ? t('auth.resend.sending') : notice ? t('auth.resend.sent') : ''}
        </p>
      </form>
      <div className="stack resend">
        {notice ? <p className="hint">{t('auth.resend.sent')}</p> : null}
        {status.resend_allowed ? null : <p className="hint">{t('auth.resend.wait', { time: formatClock(status.resend_available_at) })}</p>}
        <div className="actions">
          <button type="button" className="btn btn-quiet" aria-disabled={!status.resend_allowed || busy !== null} onClick={() => status.resend_allowed && void resend()}>
            {busy === 'resend' ? t('auth.resend.sending') : t('auth.resend.button')}
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setChallenge(null);
              void navigate('/sign-in');
            }}
          >
            {t('auth.verify.change_number')}
          </button>
        </div>
      </div>
    </>
  );
}
