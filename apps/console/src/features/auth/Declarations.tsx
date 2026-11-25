import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { ErrorSummary, Group, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { t } from '../../i18n/t';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';
import { useAuthFlow } from './flow';

/**
 * Required account-creation declarations (AUTH-02 S24): the 18+ declaration and the accepted policy version. A missing
 * or false answer is refused with one uniform message that never says which was missing.
 */
export function Declarations() {
  const session = useSession();
  const flow = useAuthFlow();
  const [adult, setAdult] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const version = flow.policyVersion;
  if (!version) return <Navigate to="/sign-in" replace />;
  const errors: FieldError[] = error ? [{ fieldId: 'declarations', message: error }] : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !version) return;
    setProblem(null);
    if (!adult || !policy) {
      setError(t('auth.decl.error'));
      setFocusToken((n) => n + 1);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await session.selected.transport.send('auth.declarations.accept', { adult_declaration: adult, policy_accepted: policy, policy_version: version });
      await session.refresh();
    } catch (e) {
      const failure = asTransportError(e);
      if (failure.code === 'VALIDATION_FAILED') {
        setError(t('auth.decl.error'));
        setFocusToken((n) => n + 1);
      } else setProblem(failure);
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title={t('auth.decl.title')}>{t('auth.decl.title')}</PageTitle>
      <p className="lead">{t('auth.decl.lead')}</p>
      <ErrorSummary errors={errors} focusToken={focusToken} />
      <form onSubmit={(e) => void submit(e)} noValidate className="stack">
        <Group id="declarations" legend={t('auth.decl.title')} error={error}>
          <label className="choice">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>{t('auth.decl.adult')}</span>
          </label>
          <label className="choice">
            <input type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)} />
            <span>{t('auth.decl.policy', { version })}</span>
          </label>
        </Group>
        <p className="hint">{t('auth.decl.note')}</p>
        <Problem error={problem} />
        <div className="actions">
          <button type="submit" className="btn btn-highlight" aria-disabled={busy}>
            {busy ? t('auth.decl.creating') : t('auth.decl.submit')}
          </button>
        </div>
        <p role="status" className="sr-only">
          {busy ? t('auth.decl.creating') : ''}
        </p>
      </form>
    </>
  );
}
