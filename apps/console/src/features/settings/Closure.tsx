import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { ClosureView } from '../../contracts/gap-sc-team';
import { Field } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StepUp } from '../stepup/StepUp';

/**
 * Close this Seller (SC-FE-11; PRV-01 S32, ONB-01 S180, CONSOLE-02 S20, S131; RB25-D11). Owner only, Console only, with fresh proof and the
 * Seller's name typed. The page states what closing does and what it keeps, and what blocks it now; no payment or debt can ever block it. The
 * request is recorded and can be cancelled; the designs define no closure states or processing yet, so nothing is unpublished or removed here.
 * An Admin sees the page and the consequences, without the action.
 */
export function Closure() {
  const { sellerId } = useSeller();
  const query = useSellerQuery('seller.closure.get', {});
  const run = useSellerCommand();
  const action = useAction();
  const [latest, setLatest] = useState<ClosureView | null>(null);
  const [typed, setTyped] = useState('');
  const [stepUp, setStepUp] = useState(false);

  if (query.state.status === 'loading') return <Skeleton rows={5} />;
  if (query.state.status === 'error') {
    return (
      <StatePanel kind="danger" alert title={t('closure.error_title')} actions={<button type="button" className="btn btn-primary" onClick={query.retry}>{t('state.retry')}</button>}>
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }
  const view = latest ?? query.state.data;

  function begin(event: FormEvent) {
    event.preventDefault();
    if (typed.trim() !== view.seller_name) {
      action.fail({ typed_name: 'CLOSURE_NAME_MISMATCH' });
      return;
    }
    setStepUp(true);
  }
  async function submit(grant: string) {
    setStepUp(false);
    const next = await action.run(() => run('seller.closure.request', { step_up_grant: grant, typed_name: typed.trim() }));
    if (next) setLatest(next);
  }
  async function cancel() {
    const next = await action.run(() => run('seller.closure.cancel', {}));
    if (next) setLatest(next);
  }

  return (
    <>
      <PageTitle title={t('closure.title')}>{t('closure.title')}</PageTitle>
      <p>
        <Link to={sellerPath(sellerId, 'settings')}>{t('settings.back')}</Link>
      </p>
      <Section id="consequences" title={t('closure.consequences_title')}>
        <ul>
          {view.consequences.map((c) => (
            <li key={c}>{label('closure.consequence', c)}</li>
          ))}
        </ul>
        <p className="notice">
          <Icon name="info" />
          <span>{t('closure.nothing_owed')}</span>
        </p>
      </Section>
      <Section id="closure" title={t('closure.request_title')}>
        <ActionProblem action={action} />
        {view.state === 'CLOSURE_REQUESTED' ? (
          <div className="stack">
            <p role="status">{t('closure.requested', { time: view.requested_at ? formatInstant(view.requested_at) : '' })}</p>
            <p className="hint">{t('closure.waiting_note')}</p>
            {view.allowed_actions.includes('CANCEL') ? (
              <div className="actions">
                <button type="button" className="btn btn-quiet" onClick={() => void cancel()}>
                  {t('closure.cancel')}
                </button>
              </div>
            ) : null}
          </div>
        ) : view.blockers.length > 0 ? (
          <ul>
            {view.blockers.map((b) => (
              <li key={b}>{label('closure.blocker', b)}</li>
            ))}
          </ul>
        ) : view.allowed_actions.includes('REQUEST') ? (
          <form onSubmit={begin} noValidate className="stack">
            <Field id="typed_name" label={t('closure.type_name', { name: view.seller_name })} error={action.fields['typed_name']}>
              {(control) => <input {...control} className="text-input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
            </Field>
            <div className="actions">
              <button type="submit" className="btn btn-quiet">
                {t('closure.start')}
              </button>
            </div>
          </form>
        ) : (
          <p className="hint">{t('closure.owner_only')}</p>
        )}
      </Section>
      <StepUp open={stepUp} purpose="CLOSE_SELLER" sellerId={sellerId} onClose={() => setStepUp(false)} onGranted={(g) => void submit(g)} />
    </>
  );
}
