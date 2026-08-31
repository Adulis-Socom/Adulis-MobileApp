/**
 * features/entry/Home.tsx -- SC-01, ADU-CON-03 v1.1 S6.
 *
 * TWO LIVES, ONE ROUTE. Before publication this screen is the readiness hub;
 * after it, the daily brief. Which one renders is decided by the SERVER's
 * readiness rows, never by a flag this client keeps.
 *
 * ==========================================================================
 * IT IS NOT A WIZARD, and that is the design, not a simplification.
 * ==========================================================================
 * No step numbers. No enforced order. No "next". A seller does these across
 * several days, in whatever order the paperwork arrives in, and must be able
 * to leave and come back to exactly what they left. So every item is
 * independently addressable, every one carries its own resolving control, and
 * nothing here remembers a position -- because there is no position to
 * remember. The screen is a LIST OF WHAT IS OUTSTANDING, and a list has no
 * cursor.
 *
 * ==========================================================================
 * THE CLIENT COMPUTES NO BUSINESS STATE (S3.1)
 * ==========================================================================
 * This screen does NOT decide which items are done, what order they appear
 * in, or what unblocks each. It renders `readiness[]` in the order the server
 * returned it, reads `satisfied` per row, and maps `resolving_action.kind` to
 * a route. The only arithmetic is counting satisfied rows for the progress
 * line, which S6 permits in exactly those words: "it counts satisfied rows".
 *
 * NINE ITEMS, NOT TEN. R7(c) removed ACTIVE_HOURS -- zero windows is a valid
 * configuration, so an availability gate would be satisfied for everyone
 * forever, and a gate that never fails teaches the reader that satisfied rows
 * mean nothing. The count is not asserted here either: the list is whatever
 * the server sends, and if that ever stops being nine the fix is upstream.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { fillTemplate } from '../../lib/intl';

interface ReadinessItem {
  code: string;
  kind: 'READINESS_ITEM';
  satisfied: boolean;
  resolving_action?: { kind: string };
}

/**
 * Item code -> the label a person reads. A code the server sends that is not
 * in here still RENDERS -- as its own code -- because a screen that silently
 * drops a row it does not recognise turns a new readiness requirement into an
 * invisible one, and the seller would be blocked by something the screen
 * never showed them.
 */
const ITEM_LABEL: Readonly<Record<string, string>> = {
  ACCOUNT_CREATED: en['console.home.item.account_created'],
  SELLER_TYPE_DECLARED: en['console.home.item.seller_type_declared'],
  ELIGIBILITY_SATISFIED: en['console.home.item.eligibility_satisfied'],
  IDENTITY_VERIFIED: en['console.home.item.identity_verified'],
  COMPANY_DETAILS: en['console.home.item.company_details'],
  STORE_PROFILE: en['console.home.item.store_profile'],
  PAYOUT_DETAILS: en['console.home.item.payout_details'],
  FULFILMENT_CONFIG: en['console.home.item.fulfilment_config'],
  AT_LEAST_ONE_PRODUCT: en['console.home.item.at_least_one_product'],
};

/**
 * Resolving action -> where it is resolved. The server names the ACTION; this
 * table says which screen carries it, which is a client-side routing fact and
 * the only mapping this screen is entitled to make. Screens not yet built
 * resolve to their placeholder, so the link is never dead and never lies
 * about being ready.
 */
const ACTION_ROUTE: Readonly<Record<string, string>> = {
  COMPLETE_ELIGIBILITY: 'eligibility',
  COMPLETE_IDENTITY_VERIFICATION: 'eligibility',
  COMPLETE_COMPANY_DETAILS: 'profile',
  COMPLETE_STORE_PROFILE: 'profile',
  ADD_PAYOUT_DETAILS: 'payouts',
  ADD_FULFILMENT_METHOD: 'fulfilment',
  ADD_A_PRODUCT: 'products',
};

export function Home() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [state, setState] = useState<UiState>('LOADING');
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ items: ReadinessItem[] }>('/seller/readiness', { sellerId });
      setItems(r.items);
      setProblem(null);
      setState('READY');
    } catch (e) {
      // A non-ApiError is a bug in this client, not a server problem, and
      // fabricating a problem envelope for it would put a made-up request id
      // in front of support. TRANSPORT_ERROR with no envelope is the honest
      // rendering (ScreenState takes `problem` as optional for this reason).
      if (e instanceof ApiError) {
        setProblem(e);
        setState(e.problem.status === 403 ? 'NO_PERMISSION' : 'TRANSPORT_ERROR');
      } else {
        setProblem(null);
        setState('TRANSPORT_ERROR');
      }
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const satisfied = items.filter((i) => i.satisfied).length;
  const published = items.length > 0 && satisfied === items.length;

  return (
    <main className="screen home">
      <h1>{en['console.home.title']}</h1>

      <ScreenState
        state={state}
        {...(problem ? { problem: problem.problem } : {})}
        onRetry={() => void load()}
        emptyText={en['console.home.no_items']}
      >
        {published ? (
          <DailyBrief />
        ) : (
          <section aria-labelledby="readiness-heading">
            <h2 id="readiness-heading">{en['console.home.readiness_title']}</h2>

            {/*
              A count, not a step indicator. "3 of 9 done" is a fact about a
              set; "step 3 of 9" is a claim about an order, and there is no
              order. aria-live so the number is announced when an item is
              resolved and the seller returns to this screen.
            */}
            <p className="progress" aria-live="polite">
              {fillTemplate(en['console.home.progress'], {
                done: String(satisfied),
                total: String(items.length),
              })}
            </p>
            <p className="hint">{en['console.home.not_a_wizard']}</p>

            <ul className="readiness-list">
              {items.map((item) => (
                <li
                  key={item.code}
                  className={item.satisfied ? 'readiness-item done' : 'readiness-item todo'}
                  data-item={item.code}
                  data-satisfied={item.satisfied ? 'true' : 'false'}
                >
                  <span className="readiness-status" aria-hidden="true">
                    {item.satisfied ? '✓' : '○'}
                  </span>
                  <span className="readiness-label">
                    {ITEM_LABEL[item.code] ?? item.code}
                    <span className="visually-hidden">
                      {item.satisfied
                        ? ` — ${en['console.home.item_done']}`
                        : ` — ${en['console.home.item_todo']}`}
                    </span>
                  </span>
                  {!item.satisfied && item.resolving_action ? (
                    <ResolvingLink kind={item.resolving_action.kind} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}
      </ScreenState>
    </main>
  );
}

function ResolvingLink({ kind }: { kind: string }) {
  const route = ACTION_ROUTE[kind];
  // An action the server names and this build has no route for is SHOWN and
  // not linked, with its own code visible. Rendering nothing would hide a
  // blocking requirement; inventing a route would send the seller somewhere
  // that cannot resolve it.
  if (!route) {
    return <span className="readiness-action unrouted">{kind}</span>;
  }
  return (
    <Link className="readiness-action" to={route}>
      {en['console.home.resolve']}
    </Link>
  );
}

/**
 * Life 2, ordered by consequence (S6): orders awaiting payment confirmation,
 * orders paid and awaiting handoff, open claims, stock at confidence 4-5,
 * unread messages, and a small activity summary.
 *
 * R23 -- THE SUMMARY IS A ROLLING 7 DAYS AGAINST THE PRECEDING 7, FIXED, AND
 * THERE IS NO PICKER. Seven days smooths the weekday/weekend swing that
 * dominates a small retailer's numbers without being long enough to hide a
 * change worth acting on. The picker belongs on SC-12, which is where a
 * seller goes to ASK a question; Home answers the question they did not ask,
 * and a control here invites fiddling with a number meant to be glanceable.
 *
 * NOT BUILT IN THIS STAGE, and stated rather than stubbed silently: the brief
 * needs GET /v1/seller/orders?status=needs_action, /v1/seller/analytics/
 * overview and /v1/notifications, and each row needs the clock rules SC-03
 * carries (the countdown means a different thing in every order state, and
 * PAYMENT_CONFIRMED shows none at all). Building it as a list of numbers
 * without those rules is how a running timer ends up on a paid order.
 */
function DailyBrief() {
  return (
    <section aria-labelledby="brief-heading">
      <h2 id="brief-heading">{en['console.home.brief_title']}</h2>
      <p className="empty">{en['console.home.brief_pending']}</p>
    </section>
  );
}
