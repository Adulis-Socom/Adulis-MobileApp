import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorSummary, Field, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';
import { looksLikePhone } from './flow';

/** Account recovery ENTRY only (GAP-SC-01): it records the request and answers the same way for every number. */
export function Recovery() {
  const session = useSession();
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const errors: FieldError[] = fieldError ? [{ fieldId: 'recovery-phone', message: fieldError }] : [];

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
      await session.selected.transport.send('auth.recovery.start', { phone });
      setDone(true);
    } catch (error) {
      setProblem(asTransportError(error));
    }
    setBusy(false);
  }

  if (done) {
    return (
      <>
        <PageTitle title={t('auth.recovery.title')}>{t('auth.recovery.title')}</PageTitle>
        <StatePanel kind="success" title={t('auth.recovery.done_title')}>
          <p>{t('auth.recovery.done_body')}</p>
        </StatePanel>
        <div className="actions">
          <Link className="btn btn-primary" to="/sign-in">
            {t('auth.recovery.back')}
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <PageTitle title={t('auth.recovery.title')}>{t('auth.recovery.title')}</PageTitle>
      <p className="lead">{t('auth.recovery.lead')}</p>
      <ErrorSummary errors={errors} focusToken={focusToken} />
      <form onSubmit={(e) => void submit(e)} noValidate className="stack">
        <Field id="recovery-phone" label={t('auth.phone.label')} hint={t('auth.phone.hint')} error={fieldError}>
          {(control) => (
            <input {...control} className="text-input" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          )}
        </Field>
        <Problem error={problem} />
        <div className="actions">
          <button type="submit" className="btn btn-primary" aria-disabled={busy}>
            {busy ? t('auth.recovery.sending') : t('auth.recovery.submit')}
          </button>
          <Link className="btn btn-link" to="/sign-in">
            {t('auth.recovery.back')}
          </Link>
        </div>
        <p role="status" className="sr-only">
          {busy ? t('auth.recovery.sending') : ''}
        </p>
      </form>
    </>
  );
}
