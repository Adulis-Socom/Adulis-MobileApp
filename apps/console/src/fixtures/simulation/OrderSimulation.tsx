import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant } from '../../i18n/t';
import { ACTION_LABEL, BUCKET_LABEL, COPY, MODE_LABEL, ROLE_LABEL, SIM_MARKER, STATE_LABEL } from './copy';
import { allowedActions, apply, canPrepare, canRead, changeElsewhere, seed, SIM_BUCKETS, SimConflict, type SimAction, type SimBucket, type SimOrder, type SimRole } from './model';

type Screen = keyof typeof STATE_LABEL;
const ROLES: readonly SimRole[] = ['OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST'];
const TIMEZONE = 'Africa/Addis_Ababa';

/**
 * The internal Order experience demonstration (SC-FE-07). Two pieces of state stand for two machines: `server` is what the simulated
 * back end holds, `view` is what this screen last fetched. They differ only after "change elsewhere", which is how a stale write is shown.
 * The page computes no business state of its own: the actions it offers are the ones `allowedActions` lists for this role and Order.
 */
export function OrderSimulation() {
  const [server, setServer] = useState<readonly SimOrder[]>(seed);
  const [view, setView] = useState<readonly SimOrder[]>(seed);
  const [role, setRole] = useState<SimRole>('INVENTORY');
  const [screen, setScreen] = useState<Screen>('normal');
  const [bucket, setBucket] = useState<SimBucket>('NEEDS_ACTION');
  const [selected, setSelected] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [done, setDone] = useState(false);
  const [opened] = useState(() => Date.now());

  const order = view.find((o) => o.id === selected) ?? null;
  const inBucket = view.filter((o) => o.bucket === bucket);

  function act(action: SimAction) {
    if (!order) return;
    setDone(false);
    try {
      const next = apply(server, role, order.id, order.version, action);
      setServer(next);
      setView(next);
      setBucket(next.find((o) => o.id === order.id)?.bucket ?? bucket);
      setStale(false);
      setDone(true);
    } catch (error) {
      if (error instanceof SimConflict) setStale(true);
      else throw error;
    }
  }
  function reset() {
    setServer(seed());
    setView(seed());
    setBucket('NEEDS_ACTION');
    setSelected(null);
    setStale(false);
    setDone(false);
  }

  return (
    <main id="main" className="page" data-sim-marker={SIM_MARKER}>
      <PageTitle title={COPY.title}>{COPY.title}</PageTitle>
      <p className="notice">
        <Icon name="info" />
        <span>{COPY.notice}</span>
      </p>
      <p className="hint">{COPY.scope}</p>

      <section className="panel stack" aria-labelledby="sim-controls">
        <h2 id="sim-controls">{COPY.controls}</h2>
        <div className="field">
          <label htmlFor="sim-role">{COPY.role}</label>
          <select id="sim-role" className="text-input" value={role} onChange={(e) => setRole(e.target.value as SimRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sim-screen">{COPY.screenState}</label>
          <select id="sim-screen" className="text-input" value={screen} onChange={(e) => setScreen(e.target.value as Screen)}>
            {(Object.keys(STATE_LABEL) as Screen[]).map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={reset}>
            {COPY.reset}
          </button>
        </div>
      </section>

      {!canRead(role) ? (
        <StatePanel kind="neutral" title={COPY.noAccessTitle}>
          <p>{COPY.noAccessBody}</p>
        </StatePanel>
      ) : screen === 'loading' ? (
        <div aria-busy="true" aria-label={COPY.loadingLabel}>
          <Skeleton rows={4} />
        </div>
      ) : screen === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={COPY.errorTitle}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setScreen('normal')}>
              {COPY.retry}
            </button>
          }
        >
          <p>{COPY.errorBody}</p>
        </StatePanel>
      ) : (
        <>
          <nav aria-label={COPY.listLabel} className="actions">
            {SIM_BUCKETS.map((b) => (
              <button key={b} type="button" className="btn btn-quiet" aria-pressed={bucket === b} onClick={() => setBucket(b)}>
                {BUCKET_LABEL[b]} ({screen === 'empty' ? 0 : view.filter((o) => o.bucket === b).length})
              </button>
            ))}
          </nav>
          {screen === 'empty' || inBucket.length === 0 ? (
            <p className="empty">{COPY.empty}</p>
          ) : (
            <ul className="ledger" aria-label={COPY.listLabel}>
              {inBucket.map((o) => (
                <li key={o.id} className="ledger-row">
                  <span className="ledger-main">
                    <span className="ledger-title">{o.id}</span>
                    <span className="ledger-meta">
                      {o.buyerLabel}, {MODE_LABEL[o.mode]}
                    </span>
                  </span>
                  <button type="button" className="btn btn-quiet" aria-label={`${COPY.open} ${o.id}`} aria-current={selected === o.id ? 'true' : undefined} onClick={() => { setSelected(o.id); setStale(false); setDone(false); }}>
                    {COPY.open}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className="panel stack" aria-labelledby="sim-detail">
            <h2 id="sim-detail">{COPY.detail}</h2>
            {order === null || screen === 'empty' ? (
              <p className="empty">{COPY.pick}</p>
            ) : (
              <>
                <dl className="facts">
                  <dt>{COPY.reference}</dt>
                  <dd>{order.id}</dd>
                  <dt>{COPY.buyer}</dt>
                  <dd>{order.buyerLabel}</dd>
                  <dt>{COPY.created}</dt>
                  <dd>
                    <time dateTime={new Date(opened - order.createdMinutesAgo * 60000).toISOString()}>{formatInstant(new Date(opened - order.createdMinutesAgo * 60000).toISOString(), TIMEZONE)}</time>
                  </dd>
                  <dt>{COPY.method}</dt>
                  <dd>{MODE_LABEL[order.mode]}</dd>
                  <dt>{COPY.status}</dt>
                  <dd>
                    <Badge tone={order.bucket === 'READY' ? 'success' : order.bucket === 'PREPARING' ? 'info' : 'warn'}>{BUCKET_LABEL[order.bucket]}</Badge>
                  </dd>
                </dl>
                <h3>{COPY.lines}</h3>
                <ul className="ledger" aria-label={COPY.lines}>
                  {order.lines.map((l) => (
                    <li key={`${l.title}-${l.variant}`} className="ledger-row">
                      <span className="ledger-main">
                        <span className="ledger-title">{l.title}</span>
                        <span className="ledger-meta">{l.variant}</span>
                      </span>
                      <span className="ledger-meta">{`${COPY.quantity}: ${l.quantity}`}</span>
                    </li>
                  ))}
                </ul>
                {stale ? (
                  <StatePanel
                    kind="warn"
                    alert
                    title={COPY.staleTitle}
                    actions={
                      <button type="button" className="btn btn-primary" onClick={() => { setView(server); setStale(false); }}>
                        {COPY.reload}
                      </button>
                    }
                  >
                    <p>{COPY.stale}</p>
                  </StatePanel>
                ) : null}
                {done ? <p role="status">{COPY.actionDone}</p> : null}
                {!canPrepare(role) ? <p className="hint">{COPY.readOnly}</p> : null}
                <div className="actions">
                  {allowedActions(role, order).map((a) => (
                    <button key={a} type="button" className="btn btn-highlight" onClick={() => act(a)}>
                      {ACTION_LABEL[a]}
                    </button>
                  ))}
                  {canPrepare(role) && order.bucket !== 'READY' ? (
                    <button type="button" className="btn btn-quiet" onClick={() => setServer((s) => changeElsewhere(s, order.id))}>
                      {COPY.changeElsewhere}
                    </button>
                  ) : null}
                </div>
                {order.bucket === 'READY' ? <p className="hint">{COPY.noMoreSteps}</p> : null}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
