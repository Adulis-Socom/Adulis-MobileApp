/**
 * auth/SignIn.tsx -- SC-00 (ADU-CON-03 v1.1 S6). Phone -> OTP -> session.
 * The only sign-in path; there is no password and no email.
 *
 * Regions in the spec's reading order: brand mark, phone entry with country
 * prefix, "Remember this device" (OFF by default -- ADU-AUTH-01 v2.5
 * S8.1a: a seller must choose it), request button; after request: code
 * entry, resend with countdown, change number, help link.
 *
 * Idempotency keys are minted ON MOUNT of each step, never on click (S7):
 * a double-tap is one key and the server replays. Resend is deliberately
 * NOT keyed -- it is a different action with its own server-side backoff
 * ladder, and its countdown belongs to resend, not to re-request.
 *
 * States used here: READY, VALIDATION (summary + per-field, submit stays
 * enabled), CONFLICT (rate limited -- shows when they may retry, from the
 * Retry-After slot), TRANSPORT_ERROR (request id shown, selectable).
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError, deviceId } from '../api/client';
import { useIdempotencyKey } from '../lib/idempotency';
import { fillTemplate } from '../lib/intl';
import { useSession } from './session';
import { ProblemBanner, ValidationSummary } from '../components/Feedback';

type Step = 'phone' | 'code';

const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export function SignIn() {
  const nav = useNavigate();
  const location = useLocation();
  const { refresh } = useSession();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+251');
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const requestKey = useIdempotencyKey();
  const verifyKey = useIdempotencyKey();

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const request = async () => {
    setProblem(null);
    if (!PHONE_RE.test(phone)) {
      setFieldErrors({ phone: en['console.signin.phone_invalid'] });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await api('/auth/otp/request', {
        method: 'POST',
        idempotencyKey: requestKey.current(),
        body: { phone, purpose: 'SIGN_IN' },
      });
      setStep('code');
      setResendAt(Date.now() + 30_000);
      // The intent is COMPLETE. Holding the key past it made the next
      // request a replay: the server returned the stored 202 and dispatched
      // no SMS, while this screen advanced to the code step and started a
      // countdown for a code nobody sent.
      requestKey.remint();
    } catch (e) {
      if (e instanceof ApiError) {
        setProblem(e);
        armResend(e);
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * The server's resend ladder is 30s, then 60s, then a 900s block
   * (otp.service.ts). A flat client-side 30s re-enables the button while the
   * server still refuses, so the seller's next tap is a guaranteed 429. When
   * the server tells us how long it wants, that is the number we honour.
   */
  const armResend = (e: ApiError) => {
    const secs = Number(e.problem.slots?.['retry_after_seconds']);
    if (Number.isFinite(secs) && secs > 0) setResendAt(Date.now() + secs * 1000);
  };

  const resend = async () => {
    setProblem(null);
    setBusy(true);
    try {
      await api('/auth/otp/resend', { method: 'POST', body: { phone, purpose: 'SIGN_IN' } });
      setResendAt(Date.now() + 30_000);
    } catch (e) {
      if (e instanceof ApiError) {
        setProblem(e);
        armResend(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setProblem(null);
    if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: en['console.signin.code_invalid'] });
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const r = await api<{ account_id: string; expires_at: string }>('/auth/otp/verify', {
        method: 'POST',
        idempotencyKey: verifyKey.current(),
        body: {
          phone,
          code,
          audience: 'CONSOLE',
          device_id: deviceId,
          remember_device: remember,
        },
      });
      void r;
      // Read the session back from the server rather than believing the
      // checkbox: remembered-ness is decided by the device cookie the server
      // received, and the verify response carries neither that nor the
      // session id that signing out needs.
      await refresh();
      const from = (location.state as { from?: string } | null)?.from;
      nav(from && from !== '/sign-in' ? from : '/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const resendWaitS = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const summary = Object.entries(fieldErrors).map(([field, message]) => ({ field, message }));

  return (
    <main className="signin">
      <h1>{en['app.title']}</h1>
      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {summary.length > 0 ? <ValidationSummary errors={summary} idPrefix="signin" /> : null}

      {step === 'phone' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void request();
          }}
        >
          <label htmlFor="signin-phone">{en['console.signin.phone_label']}</label>
          <input
            id="signin-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            aria-describedby={fieldErrors['phone'] ? 'signin-phone-error' : undefined}
            aria-invalid={fieldErrors['phone'] ? true : undefined}
          />
          {fieldErrors['phone'] ? (
            <p id="signin-phone-error" className="field-error" role="alert">
              {fieldErrors['phone']}
            </p>
          ) : null}

          <div className="remember">
            <input
              id="signin-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="signin-remember">{en['console.signin.remember_label']}</label>
            <p className="hint">{en['console.signin.remember_help']}</p>
          </div>

          {/* Submit stays ENABLED so validation can be triggered (S15). */}
          <button type="submit" aria-busy={busy}>
            {en['console.signin.request_button']}
          </button>
          <a className="help" href="https://help.adulis.example" rel="noreferrer">
            {en['console.signin.help_link']}
          </a>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label htmlFor="signin-code">{en['console.signin.code_label']}</label>
          <p className="hint">
            {fillTemplate(en['console.signin.code_help'], { phone })}
          </p>
          <input
            id="signin-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            aria-describedby={fieldErrors['code'] ? 'signin-code-error' : undefined}
            aria-invalid={fieldErrors['code'] ? true : undefined}
          />
          {fieldErrors['code'] ? (
            <p id="signin-code-error" className="field-error" role="alert">
              {fieldErrors['code']}
            </p>
          ) : null}
          <button type="submit" aria-busy={busy}>
            {en['console.signin.verify_button']}
          </button>
          <button type="button" disabled={resendWaitS > 0} onClick={() => void resend()}>
            {resendWaitS > 0
              ? fillTemplate(en['console.signin.resend_countdown'], {
                  seconds: String(resendWaitS),
                })
              : en['console.signin.resend_button']}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setProblem(null);
              // A different number is a DIFFERENT request. Reusing the key
              // made the server compare body hashes and answer 409
              // IDEMPOTENCY_KEY_REUSED -- "This retry key was already used
              // for a different request" -- on a control the seller was
              // invited to press.
              requestKey.remint();
            }}
          >
            {en['console.signin.change_number']}
          </button>
        </form>
      )}
    </main>
  );
}
