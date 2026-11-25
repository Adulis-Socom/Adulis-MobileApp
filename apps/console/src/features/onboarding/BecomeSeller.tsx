import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { OnboardingMarket, SellerType } from '../../contracts/gap-sc';
import { ErrorSummary, Field, Group, type FieldError } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Problem } from '../../components/Problem';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { PlainFrame } from '../../layout/PlainFrame';
import { sellerPath } from '../../seller/access';
import { useSession } from '../../session/SessionProvider';
import { asTransportError, type TransportError } from '../../transport/port';

const HANDLE = /^[a-z0-9._]{3,30}$/;

/**
 * Becoming a Seller (ONB-01 S19): type, store name and handle in an explicitly active onboarding Market. No
 * government ID, no payout, no payment: admission is decided from social-business evidence on the next screen.
 */
export function BecomeSeller() {
  const session = useSession();
  const navigate = useNavigate();
  const { transport } = session.selected;
  const [market, setMarket] = useState<OnboardingMarket | null>(null);
  const [marketError, setMarketError] = useState<TransportError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<SellerType | null>(null);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [errors, setErrors] = useState<Record<'type' | 'name' | 'handle', string | undefined>>({ type: undefined, name: undefined, handle: undefined });
  const [problem, setProblem] = useState<TransportError | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  // Minted when the form MOUNTS, not on click: a key minted per tap is a new key per retry, which defeats it.
  const keyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let live = true;
    transport
      .send('market.onboarding.get', {})
      .then((m) => {
        if (live) {
          setMarket(m);
          setMarketError(null);
        }
      })
      .catch((error: unknown) => {
        if (live) setMarketError(asTransportError(error));
      });
    return () => {
      live = false;
    };
  }, [transport, attempt]);

  const summary: FieldError[] = [
    ...(errors.type ? [{ fieldId: 'seller-type', message: errors.type }] : []),
    ...(errors.name ? [{ fieldId: 'store-name', message: errors.name }] : []),
    ...(errors.handle ? [{ fieldId: 'store-handle', message: errors.handle }] : []),
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !market) return;
    setProblem(null);
    const next = {
      type: type ? undefined : t('become.type.required'),
      name: name.trim() ? undefined : t('become.name.required'),
      handle: HANDLE.test(handle) ? undefined : t('become.handle.invalid'),
    };
    setErrors(next);
    if (next.type || next.name || next.handle || !type) {
      setFocusToken((n) => n + 1);
      return;
    }
    setBusy(true);
    try {
      const created = await transport.send('seller.create', { market_id: market.market_id, seller_type: type, display_name: name.trim(), handle }, { idempotencyKey: keyRef.current });
      await session.refresh();
      void navigate(sellerPath(created.id, 'admission'));
    } catch (error) {
      const e = asTransportError(error);
      if (e.code === 'VALIDATION_FAILED') {
        // The payload will change, so the next attempt is a different command and needs its own key.
        keyRef.current = crypto.randomUUID();
        setErrors({
          type: undefined,
          name: e.fields['display_name'] ? t('become.name.required') : undefined,
          handle: e.fields['handle'] === 'HANDLE_TAKEN' ? t('become.handle.taken') : e.fields['handle'] ? t('become.handle.invalid') : undefined,
        });
        setFocusToken((n) => n + 1);
      } else setProblem(e);
      setBusy(false);
    }
  }

  return (
    <PlainFrame>
      <PageTitle title={t('become.title')}>{t('become.title')}</PageTitle>
      <p className="lead">{t('become.lead')}</p>
      {marketError ? (
        <StatePanel
          kind="danger"
          alert
          title={t('state.transport_error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : !market ? (
        <Skeleton rows={4} />
      ) : (
        <>
          <ErrorSummary errors={summary} focusToken={focusToken} />
          <form onSubmit={(e) => void submit(e)} noValidate className="stack">
            <Group id="seller-type" legend={t('become.type.legend')} error={errors.type}>
              <label className="choice">
                <input type="radio" name="seller_type" checked={type === 'INDIVIDUAL'} onChange={() => setType('INDIVIDUAL')} />
                <span>
                  <strong>{t('seller.type.INDIVIDUAL')}</strong>
                  <span className="hint block">{t('become.type.individual_hint')}</span>
                </span>
              </label>
              <label className="choice">
                <input type="radio" name="seller_type" checked={type === 'COMPANY'} onChange={() => setType('COMPANY')} />
                <span>
                  <strong>{t('seller.type.COMPANY')}</strong>
                  <span className="hint block">{t('become.type.company_hint')}</span>
                </span>
              </label>
            </Group>
            <Field id="store-name" label={t('become.name.label')} hint={t('become.name.hint')} error={errors.name}>
              {(control) => <input {...control} className="text-input" type="text" autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field id="store-handle" label={t('become.handle.label')} hint={t('become.handle.hint')} error={errors.handle}>
              {(control) => (
                <input {...control} className="text-input" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={handle} onChange={(e) => setHandle(e.target.value)} />
              )}
            </Field>
            <p className="hint">{t('become.market', { country: market.country, timezone: market.timezone })}</p>
            <p className="hint">{t('become.no_id')}</p>
            <Problem error={problem} />
            <div className="actions">
              <button type="submit" className="btn btn-highlight" aria-disabled={busy}>
                {busy ? t('become.creating') : t('become.submit')}
              </button>
              <Link className="btn btn-link" to="/sellers">
                {t('become.cancel')}
              </Link>
            </div>
            <p role="status" className="sr-only">
              {busy ? t('become.creating') : ''}
            </p>
          </form>
        </>
      )}
    </PlainFrame>
  );
}
