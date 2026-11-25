import { Link } from 'react-router';
import type { DestinationKey, ReadinessItem, SellerAccess } from '../../contracts/gap-sc';
import { Badge, type Tone } from '../../components/Badge';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { codeText, label, t } from '../../i18n/t';
import { destinationAccess, sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { statusOf, type Status } from './status';

const STATUS_TONE: Record<Status, Tone> = { done: 'success', todo: 'warn', waiting: 'neutral', blocked: 'neutral' };

/**
 * Where a resolving action leads. Only the admission step is built in this release; the others lead to destinations
 * that honestly say they arrive later. An unknown kind has no destination, so it shows no action at all.
 */
const TARGETS: Record<string, { dest: DestinationKey; path: string; built: boolean }> = {
  CONNECT_SOCIAL_ACCOUNT: { dest: 'home', path: 'admission', built: true },
  EDIT_COMPANY_DETAILS: { dest: 'store', path: 'store', built: false },
  EDIT_STORE_PROFILE: { dest: 'store', path: 'store', built: false },
  CONFIGURE_FULFILMENT: { dest: 'store', path: 'store', built: false },
  ADD_PRODUCT: { dest: 'products', path: 'products', built: false },
};

function actionFor(item: ReadinessItem, access: SellerAccess, sellerId: string) {
  const action = item.resolving_action;
  if (item.satisfied || !action) return null;
  // Missing permission hides the control entirely; the row says who can do it instead.
  if (action.denied === 'NO_PERMISSION') return { kind: 'hidden' as const };
  const label = codeText('readiness.action', action.kind) ?? t('readiness.action.unknown');
  if (action.denied === 'NO_ENTITLEMENT') return { kind: 'disabled' as const, label };
  const target = TARGETS[action.kind];
  // An action whose destination this account cannot see is not offered: the permission is missing, so it is hidden.
  if (!target || destinationAccess(access, target.dest) === 'HIDDEN') return { kind: 'hidden' as const };
  return { kind: 'link' as const, label, to: sellerPath(sellerId, target.path), built: target.built };
}

function Row({ item, limeHere }: { item: ReadinessItem; limeHere: boolean }) {
  const { sellerId, access } = useSeller();
  const status = statusOf(item);
  const title = codeText('readiness', item.code) ?? t('readiness.unknown_item', { code: item.code });
  const action = actionFor(item, access, sellerId);
  const reasons = item.satisfied ? [] : item.reason_codes.map((c) => codeText('reason', c) ?? t('reason.unknown', { code: c }));
  const waiting = item.workflow_state ? codeText('readiness.waiting', item.workflow_state) : null;
  return (
    <li className="ledger-row">
      <div className="ledger-main">
        <span className="ledger-title">{title}</span>
        <Badge tone={STATUS_TONE[status]} icon={status === 'waiting' ? 'clock' : status === 'blocked' ? 'lock' : undefined}>
          {label('readiness.status', status)}
        </Badge>
        {status === 'waiting' && waiting ? <span className="ledger-meta">{waiting}</span> : null}
        {reasons.map((r) => (
          <span key={r} className="ledger-meta">
            {r}
          </span>
        ))}
        {status === 'blocked' ? <span className="ledger-meta">{t('readiness.no_permission_note')}</span> : null}
        {action?.kind === 'link' && !action.built ? (
          <span id={`later-${item.code}`} className="ledger-meta">
            {t('readiness.action_deferred')}
          </span>
        ) : null}
      </div>
      {action?.kind === 'link' && action.built ? (
        <Link className={limeHere ? 'btn btn-highlight' : 'btn btn-quiet'} to={action.to}>
          {action.label}
        </Link>
      ) : null}
      {action?.kind === 'link' && !action.built ? (
        // Not built yet: shown so the requirement is understood, disabled so nothing promises a destination that is not there.
        <button type="button" className="btn btn-quiet" aria-disabled="true" aria-describedby={`later-${item.code}`}>
          {action.label}
        </button>
      ) : null}
      {action?.kind === 'disabled' ? (
        <>
          <button type="button" className="btn btn-quiet" aria-disabled="true" aria-describedby={`ent-${item.code}`}>
            {action.label}
          </button>
          <span id={`ent-${item.code}`} className="ledger-meta">
            {t('nav.entitlement_reason')}
          </span>
        </>
      ) : null}
    </li>
  );
}

/**
 * The Publication Readiness Hub (ONB-01 S70-S80, CONSOLE-02 S30). A set of independent requirements, not a wizard:
 * any order, resumable across days, every status and every resolving action supplied by the server. The Console never
 * decides whether a Seller is ready; it shows `ready` as the server returned it.
 */
export function ReadinessHub() {
  const { sellerId, access } = useSeller();
  const { state, retry } = useSellerQuery('seller.readiness.get', {});
  return (
    <section className="panel" aria-labelledby="readiness-h">
      <h2 id="readiness-h">{t('readiness.title')}</h2>
      <p>{t('readiness.lead')}</p>
      {state.status === 'loading' ? <Skeleton rows={5} /> : null}
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('readiness.error_title')}
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
        <>
          {state.data.ready ? (
            <StatePanel kind="success" title={t('readiness.ready_title')}>
              <p>{t('readiness.ready_body')}</p>
            </StatePanel>
          ) : (
            <StatePanel kind="info" title={t('readiness.not_ready_title')}>
              <p>{t('readiness.not_ready_body')}</p>
            </StatePanel>
          )}
          <p className="hint" role="status">
            {t('readiness.summary', { met: state.data.items.filter((i) => i.satisfied).length, total: state.data.items.length })}
          </p>
          <ul className="ledger" aria-label={t('readiness.list_label')}>
            {(() => {
              // The single lime action on the screen goes to the first item that offers a built action.
              const first = state.data.items.find((i) => {
                const a = actionFor(i, access, sellerId);
                return a?.kind === 'link' && a.built;
              });
              return state.data.items.map((item) => <Row key={item.code} item={item} limeHere={item === first} />);
            })()}
          </ul>
        </>
      ) : null}
    </section>
  );
}
