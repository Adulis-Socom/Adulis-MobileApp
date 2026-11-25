import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { Eligibility, SocialChallenge, SocialPlatform } from '../../contracts/gap-sc';
import { Badge } from '../../components/Badge';
import { ErrorSummary, Field, Group, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { codeText, formatClock, label, t } from '../../i18n/t';
import { can, sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { runScoped } from '../../seller/scoped';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';

const HANDLE = /^@?[A-Za-z0-9._]{2,30}$/;

function Reasons({ codes }: { codes: readonly string[] }) {
  if (codes.length === 0) return null;
  return (
    <>
      <h3>{t('admission.reasons_title')}</h3>
      <ul className="plain-list">
        {codes.map((c) => (
          <li key={c}>{codeText('reason', c) ?? t('reason.unknown', { code: c })}</li>
        ))}
      </ul>
    </>
  );
}

function StatusPanel({ e }: { e: Eligibility }) {
  if (e.outcome === 'SATISFIED') {
    return (
      <StatePanel kind="success" title={t('admission.satisfied_title')}>
        <p>{t('admission.satisfied_body', { version: e.policy_version })}</p>
      </StatePanel>
    );
  }
  if (e.outcome === 'PENDING') {
    return (
      <StatePanel kind="neutral" title={t('admission.pending_title')}>
        <p>{e.workflow_state === 'WAITING_FOR_PROVIDER' ? t('admission.pending_provider') : t('admission.pending_dm')}</p>
      </StatePanel>
    );
  }
  if (e.outcome !== 'NOT_SATISFIED') {
    // An outcome this version does not know is shown as unknown, never as a refusal.
    return (
      <StatePanel kind="neutral" title={t('admission.pending_title')}>
        <p>{t('reason.unknown', { code: String(e.outcome) })}</p>
      </StatePanel>
    );
  }
  // NOT_SATISFIED: still actionable (the Seller can supply evidence) or a refusal under the current policy.
  const actionable = e.workflow_state === 'NEEDS_SELLER_ACTION';
  return (
    <StatePanel kind={actionable ? 'info' : 'warn'} title={actionable ? t('admission.needs_title') : t('admission.refused_title')}>
      <p>{actionable ? t('admission.needs_body') : t('admission.refused_body')}</p>
      <Reasons codes={e.reason_codes} />
    </StatePanel>
  );
}

/**
 * Social-business evidence (ONB-01 S41-S58). Control of the account is proved with a one-time code the Seller sends
 * from the claimed account to the official Adulis account; presence is judged by the server. The Console renders the
 * outcome and its reason codes and decides nothing. Direct platform connection needs the platform's approval and is
 * shown as unavailable rather than faked.
 */
export function Admission() {
  const { sellerId, access } = useSeller();
  const session = useSession();
  const { transport } = session.selected;
  const { state, retry } = useSellerQuery('seller.eligibility.get', {});
  const manage = can(access, 'admission.manage');
  const [platform, setPlatform] = useState<SocialPlatform>('TIKTOK');
  const [handle, setHandle] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState<'start' | 'recheck' | null>(null);
  const [challenge, setChallenge] = useState<SocialChallenge | null>(null);
  const [rechecked, setRechecked] = useState<Eligibility | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const errors: FieldError[] = fieldError ? [{ fieldId: 'social-handle', message: fieldError }] : [];

  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    const trimmed = handle.trim();
    if (trimmed === '' || !HANDLE.test(trimmed)) {
      setFieldError(trimmed === '' ? t('admission.handle.required') : t('admission.handle.invalid'));
      setFocusToken((n) => n + 1);
      return;
    }
    setFieldError(undefined);
    setBusy('start');
    try {
      const started = await runScoped(transport, 'seller.social.start', sellerId, { platform, handle: trimmed });
      setChallenge(started);
      setRechecked(null);
      retry();
    } catch (error) {
      const e = asTransportError(error);
      if (e.code === 'AUTHENTICATION_REQUIRED') session.expire();
      else if (e.code === 'VALIDATION_FAILED') {
        setFieldError(t('admission.handle.invalid'));
        setFocusToken((n) => n + 1);
      } else setProblem(e);
    }
    setBusy(null);
  }

  async function recheck() {
    if (busy) return;
    setProblem(null);
    setBusy('recheck');
    try {
      setRechecked(await runScoped(transport, 'seller.eligibility.recheck', sellerId, {}));
    } catch (error) {
      const e = asTransportError(error);
      if (e.code === 'AUTHENTICATION_REQUIRED') session.expire();
      else setProblem(e);
    }
    setBusy(null);
  }

  return (
    <>
      <PageTitle title={t('admission.title')}>{t('admission.title')}</PageTitle>
      <p className="lead">{t('admission.lead')}</p>
      {state.status === 'loading' ? <Skeleton rows={4} /> : null}
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('admission.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' ? (
        (() => {
          const e = rechecked ?? state.data;
          const open = e.outcome === 'NOT_SATISFIED' && e.workflow_state === 'NEEDS_SELLER_ACTION';
          return (
            <>
              <StatusPanel e={e} />
              <section className="panel" aria-labelledby="accounts-h">
                <h2 id="accounts-h">{t('admission.accounts_title')}</h2>
                {e.social_accounts.length === 0 ? (
                  <p>{t('admission.accounts_empty')}</p>
                ) : (
                  <ul className="plain-list">
                    {e.social_accounts.map((a) => (
                      <li key={`${a.platform}-${a.handle}`} className="row">
                        <span>{t('admission.account_row', { platform: label('platform', a.platform), handle: a.handle })}</span>
                        <Badge tone={a.control === 'VERIFIED' ? 'success' : a.control === 'PENDING' ? 'neutral' : 'warn'} icon={a.control === 'PENDING' ? 'clock' : undefined}>
                          {label('admission.control', a.control)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!manage ? <p className="hint">{t('admission.read_only')}</p> : null}

              {manage && (open || challenge) ? (
                <section className="panel" aria-labelledby="method-h">
                  <h2 id="method-h">{t('admission.method_title')}</h2>
                  <p className="hint">{t('admission.loginkit_off')}</p>
                  <p className="notice">{t('admission.anti_phishing')}</p>
                  {open ? (
                    <>
                      <ErrorSummary errors={errors} focusToken={focusToken} />
                      <form onSubmit={(ev) => void start(ev)} noValidate className="stack">
                        <Group id="platform-group" legend={t('admission.platform_legend')}>
                          {(['TIKTOK', 'INSTAGRAM'] as const).map((p) => (
                            <label className="choice" key={p}>
                              <input type="radio" name="platform" checked={platform === p} onChange={() => setPlatform(p)} />
                              <span>{t(`platform.${p}`)}</span>
                            </label>
                          ))}
                        </Group>
                        <Field id="social-handle" label={t('admission.handle.label')} hint={t('admission.handle.hint')} error={fieldError}>
                          {(control) => (
                            <input {...control} className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={handle} onChange={(ev) => setHandle(ev.target.value)} />
                          )}
                        </Field>
                        <div className="actions">
                          <button type="submit" className="btn btn-highlight" aria-disabled={busy !== null}>
                            {busy === 'start' ? t('admission.starting') : t('admission.start')}
                          </button>
                        </div>
                      </form>
                    </>
                  ) : null}
                  {challenge ? (
                    <div className="stack" aria-live="polite">
                      <h3>{t('admission.challenge_title')}</h3>
                      <p>{t('admission.challenge_body', { sentTo: challenge.code_sent_to })}</p>
                      <p>
                        <strong>{t('admission.official', { platform: label('platform', challenge.platform), handle: challenge.official_account_handle })}</strong>
                      </p>
                      <p className="hint">{t('admission.challenge_expires', { time: formatClock(challenge.expires_at) })}</p>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <Problem error={problem} />
              <div className="actions">
                {manage ? (
                  <button type="button" className="btn btn-quiet" aria-disabled={busy !== null} onClick={() => void recheck()}>
                    {busy === 'recheck' ? t('admission.rechecking') : t('admission.recheck')}
                  </button>
                ) : null}
                <Link className="btn btn-link" to={sellerPath(sellerId)}>
                  {t('admission.back_to_readiness')}
                </Link>
              </div>
              <p role="status" className="sr-only">
                {busy === 'start' ? t('admission.starting') : busy === 'recheck' ? t('admission.rechecking') : ''}
              </p>
            </>
          );
        })()
      ) : null}
    </>
  );
}
