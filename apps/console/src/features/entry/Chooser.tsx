/**
 * features/entry/Chooser.tsx -- "/", the seller chooser.
 *
 * T18 Phase 3 CLOSED D-97. There is now an endpoint that lists the stores an
 * account holds (GET /v1/seller/list), so this screen enumerates them instead
 * of asking a seller to paste an id they were never given. The pasted-id box
 * and the sentence that explained its absence are gone.
 *
 * S2.1's rule is honoured at last rather than described: REDIRECT WHEN EXACTLY
 * ONE. A seller with a single store never sees this screen -- they land in
 * their store, both on the day they create it and every morning after. That
 * one behaviour is what T17's walk recorded as "a returning seller is asked to
 * paste a store id", and it was the second thing that would have made a real
 * seller give up.
 *
 * The redirect REPLACES the history entry. A seller who lands in their store
 * and presses Back should leave the app, not bounce off a screen that
 * immediately forwards them again.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { AdulisProblem, UiState } from '../../lib/states';

interface SellerRow {
  readonly id: string;
  readonly handle: string;
  readonly store_name: string;
  readonly status: string;
  readonly role: string;
}

/** The role a seller reads, never the enum. Unknown values render as
 *  themselves -- visible and greppable, the ITEM_LABEL rule. */
const ROLE_LABEL: Readonly<Record<string, string>> = {
  OWNER: en['console.chooser.role.owner'],
  ADMIN: en['console.chooser.role.admin'],
  SALES_SUPPORT: en['console.chooser.role.sales_support'],
  INVENTORY: en['console.chooser.role.inventory'],
  ANALYST: en['console.chooser.role.analyst'],
  CAMPAIGN_MANAGER: en['console.chooser.role.campaign_manager'],
};

export function Chooser() {
  const nav = useNavigate();
  const [state, setState] = useState<UiState>('LOADING');
  const [rows, setRows] = useState<readonly SellerRow[]>([]);
  const [problem, setProblem] = useState<AdulisProblem | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: SellerRow[] }>('/seller/list');
      if (!alive.current) return;
      setRows(r.data);
      setProblem(null);
      // EXACTLY ONE -> go there, replacing this entry in history.
      if (r.data.length === 1 && r.data[0]) {
        nav(`/s/${r.data[0].id}`, { replace: true });
        return;
      }
      setState(r.data.length === 0 ? 'EMPTY' : 'READY');
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError) {
        setProblem(e.problem);
        setState('TRANSPORT_ERROR');
      } else {
        setProblem(null);
        setState('TRANSPORT_ERROR');
      }
    }
  }, [nav]);

  useEffect(() => {
    // The load can resolve after this screen has gone -- the redirect below
    // unmounts it, and a slow response on a session that then expires would
    // otherwise navigate or setState against a component that no longer
    // exists. The flag is checked inside load through the ref.
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  return (
    <main className="chooser">
      <h1>{en['console.chooser.title']}</h1>

      {state === 'LOADING' || state === 'TRANSPORT_ERROR' ? (
        <ScreenState
          state={state}
          {...(problem ? { problem } : {})}
          onRetry={() => void load()}
        />
      ) : null}

      {/* EMPTY is a good state here, not a failure: an account with no store
          is every seller on the day they arrive, and the only thing they need
          is the way to make one. */}
      {state === 'EMPTY' ? <p className="hint">{en['console.chooser.none']}</p> : null}

      {state === 'READY' ? (
        <ul className="seller-list">
          {rows.map((s) => (
            <li key={s.id} data-seller={s.id}>
              <Link to={`/s/${s.id}`}>{s.store_name}</Link>
              <span className="seller-handle">{s.handle}</span>
              <span className="seller-role">{ROLE_LABEL[s.role] ?? s.role}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Always available, and not only in the empty state: an account that
          already holds one store may open a second. */}
      {state === 'EMPTY' || state === 'READY' ? (
        <p className="create-store">
          {en['console.chooser.create_prompt']}{' '}
          <Link to="/s/new">{en['console.chooser.create_link']}</Link>
        </p>
      ) : null}

      {/* THE COURIER LINK MOVED TO SIGN-IN (T19 Phase 1) and survives here in
          the EMPTY state only.
          A courier is not seller staff: they hold their own account, they see
          only assigned orders, and they have no store to be redirected into.
          Sign-in is where they meet it first, and following it from there
          resumes to /courier after verifying.
          But a courier who signs in WITHOUT following that link lands here,
          on an account with no stores -- so this is the other place they
          arrive, and it is not "behind seller navigation": a person with no
          store is never redirected past this screen. In the READY state, where
          the account does hold stores, it is gone. */}
      {state === 'EMPTY' || state === 'READY' ? (
        <p className="courier-link">
          <Link to="/courier">{en['console.courier.chooser_link']}</Link>
        </p>
      ) : null}
    </main>
  );
}
