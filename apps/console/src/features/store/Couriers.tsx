import { useState, type FormEvent } from 'react';
import type { CourierRelationship, RelationshipStatus } from '../../contracts/gap-sc-store';
import { Badge, type Tone } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Form';
import type { IconName } from '../../components/Icon';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { StoreNav } from './StoreFrame';
import { useAction } from '../shared/useAction';

const LOOK: Record<RelationshipStatus, { tone: Tone; icon: IconName }> = {
  INVITED: { tone: 'info', icon: 'clock' },
  ACTIVE: { tone: 'success', icon: 'check' },
  DECLINED: { tone: 'neutral', icon: 'x' },
  REVOKED: { tone: 'neutral', icon: 'x' },
};

function Row({ item, timezone, onChange }: { item: CourierRelationship; timezone: string | undefined; onChange: () => void }) {
  const run = useSellerCommand();
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const look = LOOK[item.status] ?? { tone: 'neutral' as const, icon: 'circle' as const };
  const pending = item.status === 'INVITED';

  async function revoke() {
    const next = await action.run(() => run('couriers.revoke', { relationship_id: item.id }));
    setConfirm(false);
    if (next) onChange();
  }

  return (
    <li className="ledger-row">
      <div className="stack">
        <div className="row-start">
          <span className="ledger-title">{item.courier_display_name}</span>
          <Badge tone={look.tone} icon={look.icon}>
            {label('courier.status', item.status)}
          </Badge>
        </div>
        <p className="ledger-meta">
          {t('couriers.status_since')} <time dateTime={item.status_at}>{formatInstant(item.status_at, timezone)}</time>
        </p>
        <ActionProblem action={action} onReload={onChange} />
        {item.allowed_actions.includes('REVOKE') ? (
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => setConfirm(true)}>
              {pending ? t('couriers.withdraw_invitation', { name: item.courier_display_name }) : t('couriers.revoke', { name: item.courier_display_name })}
            </button>
          </div>
        ) : null}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={pending ? t('couriers.withdraw_title') : t('couriers.revoke_title')}>
        <p>{pending ? t('couriers.withdraw_body', { name: item.courier_display_name }) : t('couriers.revoke_body', { name: item.courier_display_name })}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" aria-disabled={action.busy} onClick={() => void revoke()}>
            {pending ? t('couriers.withdraw_confirm') : t('couriers.revoke_confirm')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>
            {t('couriers.keep')}
          </button>
        </div>
      </Dialog>
    </li>
  );
}

function Invite({ onInvited }: { onInvited: () => void }) {
  const run = useSellerCommand();
  const action = useAction();
  const [phone, setPhone] = useState('');
  async function invite(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('couriers.invite', { phone }));
    if (next) {
      setPhone('');
      onInvited();
    }
  }
  return (
    <form onSubmit={(e) => void invite(e)} noValidate className="stack">
      <h2>{t('couriers.invite_title')}</h2>
      <ActionProblem action={action} />
      <Field id="phone" label={t('couriers.phone_label')} hint={t('couriers.phone_hint')} error={action.fields['phone']}>
        {(control) => <input {...control} className="text-input" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />}
      </Field>
      <div className="actions">
        <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
          {t('couriers.invite')}
        </button>
      </div>
    </form>
  );
}

/**
 * Courier relationships (CONSOLE-02 S108, FUL-01 S13 and S16, B02B-D02): invite a Courier, see where each invitation stands, revoke.
 * That is all this release retains. Assigning a Courier to a delivery, handing items over, delivery states and Courier compensation are
 * deferred, and the server says so (`delivery_execution`), so the Console states it instead of showing any delivery state.
 */
export function Couriers() {
  const { state, retry } = useSellerQuery('couriers.list', {});
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  return (
    <>
      <PageTitle title={t('couriers.page')}>{t('couriers.page')}</PageTitle>
      <p className="lead">{t('couriers.lead')}</p>
      <StoreNav />
      {state.status === 'error' ? (
        <StatePanel kind="danger" alert title={t('couriers.error_title')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'loading' ? <Skeleton rows={3} /> : null}
      {state.status === 'ready' ? (
        <>
          {state.data.delivery_execution === 'UNAVAILABLE' ? (
            <p className="notice">
              <Icon name="info" />
              <span>{t('couriers.execution_unavailable')}</span>
            </p>
          ) : null}
          {state.data.allowed_actions.includes('INVITE') ? <Invite onInvited={retry} /> : null}
          <section className="section" aria-labelledby="relationships-h">
            <h2 id="relationships-h">{t('couriers.list_title')}</h2>
            {state.data.items.length === 0 ? (
              <p className="empty">{t('couriers.empty')}</p>
            ) : (
              <ul className="ledger" aria-label={t('couriers.list_label')} aria-busy={state.refreshing}>
                {state.data.items.map((c) => (
                  <Row key={c.id} item={c} timezone={timezone} onChange={retry} />
                ))}
              </ul>
            )}
            <p className="hint">{t('couriers.capacity_note')}</p>
          </section>
        </>
      ) : null}
    </>
  );
}
