/**
 * layout/SellerSwitcher.tsx -- the topbar's store control (T19 Phase 1).
 *
 * ADU-REPO-01 S9.2 has always said this renders "only when the account holds
 * more than one seller", and until T18 Phase 3 it could not render at all:
 * nothing listed the stores an account held (D-97). The endpoint exists now.
 *
 * IT IS BUILT HERE BECAUSE #80 SHIPPED A REDIRECT WITHOUT IT. The chooser at
 * "/" now forwards a single-store seller straight into their store, which is
 * right -- and it took "Create a store" away with it, leaving that route
 * reachable only by typing /s/new. That is exactly the failure T17 recorded as
 * the point where a real seller stops and messages the founder, reintroduced
 * by the fix for it.
 *
 * TWO RENDERINGS, ONE COMPONENT, and the split follows the ruled behaviour:
 *
 *   more than one store -> the switcher proper: the current store named, the
 *                          others listed, each a link. This is S9.2's rule.
 *   exactly one store   -> NOT a switcher. There is nothing to switch to, so
 *                          it renders the store's name and the one control
 *                          that must not be lost: create another.
 *
 * The second is the whole point of this phase. A component that rendered
 * nothing below two stores would satisfy S9.2 and leave the regression in
 * place, so the rule is read as what it protects -- a switcher with one entry
 * is a menu that lies about having a choice -- rather than as a reason to draw
 * nothing at all.
 *
 * IT FAILS QUIET, DELIBERATELY. This sits in the topbar of every seller route;
 * a failed list must not take a working Orders screen down with it. On error
 * it renders the store name alone -- exactly what the topbar showed before
 * this component existed -- and offers a retry.
 *
 * THE ERROR STATE IS NOT AN EMPTY LIST, and the first draft made it one. The
 * catch set rows to [], which is byte-identical to the success state of an
 * account holding exactly one store: a seller with three stores who hit one
 * dropped request would see the generic "Your store", a menu with no stores
 * in it, and no indication anything had failed -- for the rest of the session,
 * because the fetch runs once per Shell mount and Shell does not remount on
 * navigation. The failure is now its own state and it can be retried.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api } from '../api/client';

interface SellerRow {
  readonly id: string;
  readonly handle: string;
  readonly store_name: string;
  readonly status: string;
  readonly role: string;
}

export function SellerSwitcher() {
  const { sellerId } = useParams();
  const [rows, setRows] = useState<readonly SellerRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const alive = useRef(true);
  const box = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ data: SellerRow[] }>('/seller/list');
      if (!alive.current) return;
      setRows(r.data);
      setFailed(false);
    } catch {
      // Quiet, but NOT silent, and never mistaken for "you have one store".
      // A 401 never reaches here: api() fires the global unauthorized handler
      // first, which clears the session and lets RequireSession redirect. What
      // lands here is a transport or 5xx failure, and the honest rendering is
      // the store name alone plus a way to try again.
      if (!alive.current) return;
      setRows(null);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  // A menu with no way out is a trap on a phone. Escape closes it, a click
  // anywhere else closes it, and both are removed when it is shut so the
  // listeners are not live for the whole session.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // ...and it must not survive a navigation. Moving to another store leaves an
  // open panel describing where you no longer are.
  useEffect(() => {
    setOpen(false);
  }, [sellerId]);

  const current = rows?.find((s) => s.id === sellerId);
  const others = (rows ?? []).filter((s) => s.id !== sellerId);

  return (
    <div className="seller-switcher" data-switcher ref={box}>
      {/* The store's own name, once there is one to show. Until the list
          arrives the generic label stands, so the topbar never flashes empty. */}
      <span className="store-name">{current?.store_name ?? en['console.shell.store']}</span>

      {failed ? (
        <button type="button" className="switcher-retry" data-switcher-retry onClick={() => void load()}>
          {en['common.retry']}
        </button>
      ) : null}

      {rows === null ? null : (
        <>
          <button
            type="button"
            className="switcher-toggle"
            data-switcher-toggle
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {others.length > 0
              ? en['console.switcher.switch']
              : en['console.switcher.stores']}
          </button>

          {open ? (
            <div className="switcher-menu" data-switcher-menu>
              {others.length > 0 ? (
                <ul>
                  {others.map((s) => (
                    <li key={s.id} data-switcher-seller={s.id}>
                      <Link to={`/s/${s.id}`} onClick={() => setOpen(false)}>
                        {s.store_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {/* THE CONTROL THIS PHASE EXISTS FOR. Present whether or not
                  there is anything to switch to. */}
              <Link className="switcher-create" to="/s/new" onClick={() => setOpen(false)}>
                {en['console.chooser.create_link']}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
