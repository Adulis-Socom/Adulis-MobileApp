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
import { en, type MessageKey } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { fillTemplate } from '../../lib/intl';
import { ITEM_LABEL } from '../../lib/readiness';
import { ObligationDeadline } from '../../lib/clock';

interface ReadinessItem {
  code: string;
  kind: 'READINESS_ITEM';
  satisfied: boolean;
  resolving_action?: { kind: string };
}

/**
 * Resolving action -> where it is resolved. The server names the ACTION; this
 * table says which screen carries it, which is a client-side routing fact and
 * the only mapping this screen is entitled to make. Screens not yet built
 * resolve to their placeholder, so the link is never dead and never lies
 * about being ready.
 */
const ACTION_ROUTE: Readonly<Record<string, string>> = {
  /*
   * THE KEYS ARE THE SERVER'S, VERBATIM -- fn_publication_readiness in
   * migration 0018, and nothing else. The first version carried
   * COMPLETE_COMPANY_DETAILS, a key the server never sends, while the two it
   * does send for those rows -- DECLARE_SELLER_TYPE and
   * PROVIDE_COMPANY_DETAILS -- were missing (T11 Phase 5, D-172). A COMPANY
   * seller with company details outstanding therefore got a dead unrouted
   * span for a BLOCKING requirement: exactly D-146's shape, invisible in
   * the fixture because the seeded seller is INDIVIDUAL and both rows are
   * satisfied for it. Routes are ADU-CON-03 S6's table: item 2 -> SC-02,
   * item 5 -> SC-17.
   */
  DECLARE_SELLER_TYPE: '/s/new',
  COMPLETE_ELIGIBILITY: 'eligibility',
  COMPLETE_IDENTITY_VERIFICATION: 'eligibility',
  PROVIDE_COMPANY_DETAILS: 'profile',
  COMPLETE_STORE_PROFILE: 'profile',
  ADD_PAYOUT_DETAILS: 'payouts',
  ADD_FULFILMENT_METHOD: 'fulfilment',
  ADD_A_PRODUCT: 'products',
};

/** GET /v1/seller/obligations -- the server owns the set (v1.10 S12.12b). */
interface Obligation {
  readonly kind: string;
  readonly object_kind: 'ORDER' | 'CLAIM';
  readonly object_id: string;
  readonly deadline: string;
  readonly consequence_key: string;
}

/**
 * kind -> the screen that opens the object: the ACTION_ROUTE precedent above,
 * and the recorded reading of S12.12b's "route" cell (D-235 F5) -- a URL is a
 * client artifact, so the server names the object and this table names the
 * screen. An unknown kind renders unlinked with its code visible, exactly
 * like an unrouted readiness action.
 */
const OBLIGATION_ROUTE: Readonly<Record<string, (id: string) => string>> = {
  PAYMENT_AWAITING_CONFIRMATION: (id) => `orders/${id}`,
  ORDER_NOT_READY: (id) => `orders/${id}`,
  CLAIM_AWAITING_SELLER: (id) => `claims/${id}`,
};

export function Home() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [state, setState] = useState<UiState>('LOADING');
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [problem, setProblem] = useState<ApiError | null>(null);
  // null = not yet answered; a FAILED load stays null with the failure line
  // rendered (never the success-empty state -- the D-225 S-M3 class).
  const [obligations, setObligations] = useState<readonly Obligation[] | null>(null);
  const [obligationsFailed, setObligationsFailed] = useState(false);

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

  const loadObligations = useCallback(async () => {
    if (!sellerId) return;
    try {
      const r = await api<{ data: Obligation[] }>('/seller/obligations', { sellerId });
      setObligations(r.data);
      setObligationsFailed(false);
    } catch {
      // Failure is not emptiness: the region says it could not load and the
      // rest of Home stands. (A 403 -- a role without store:read cannot reach
      // this screen's seller scope anyway -- degrades the same way.)
      setObligationsFailed(true);
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
    void loadObligations();
  }, [load, loadObligations]);

  const satisfied = items.filter((i) => i.satisfied).length;
  const published = items.length > 0 && satisfied === items.length;

  return (
    <main className="screen home">
      <h1>{en['console.home.title']}</h1>

      {/*
        WHAT NEEDS YOU -- above everything (T16 S3.1: a seller opening Home to
        find out what needs them should not scroll past a chart). FLAT,
        nearest-deadline first AS SERVED: no client sort, no grouping (S3.2 --
        grouping by kind buries the urgent thing under a heading). Each row:
        what (the kind's title), which object (a link), when (the server
        deadline, displayed and refetched at zero, deciding nothing), and what
        happens if not (the SERVER's consequence_key, rendered verbatim).
        Empty is a GOOD state and says so beside the summary in Life 2; over
        an unfinished readiness list it says nothing extra -- the readiness
        items are what need that seller, and they are already on screen.
      */}
      {obligationsFailed ? (
        <p className="problem" role="alert" data-obligations-failed>
          {en['console.common.refetch_failed']}
        </p>
      ) : null}
      {obligations !== null && obligations.length > 0 ? (
        <section aria-labelledby="obligations-heading" className="obligations" data-obligations>
          <h2 id="obligations-heading">{en['console.home.obligations_title']}</h2>
          <ul className="obligation-list">
            {obligations.map((o) => {
              const route = OBLIGATION_ROUTE[o.kind];
              const title =
                (en as Record<string, string>)[`obligation.${o.kind.toLowerCase()}.title`] ?? o.kind;
              const consequence = (en as Record<string, string>)[o.consequence_key];
              return (
                <li key={`${o.kind}-${o.object_id}`} data-obligation={o.kind}>
                  {route ? (
                    <Link className="obligation-title" to={route(o.object_id)}>
                      {title}
                    </Link>
                  ) : (
                    <span className="obligation-title unrouted">{o.kind}</span>
                  )}
                  <ObligationDeadline deadline={o.deadline} onElapsed={() => void loadObligations()} />
                  {/* The server's sentence, verbatim. An unknown key renders
                      AS the key -- visible and greppable, the Feedback.tsx
                      precedent for message_key -- because a row whose stakes
                      silently vanish is the list learning to lie (pass). */}
                  <p className="obligation-consequence">{consequence ?? o.consequence_key}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ScreenState
        state={state}
        {...(problem ? { problem: problem.problem } : {})}
        onRetry={() => void load()}
        emptyText={en['console.home.no_items']}
      >
        {published ? (
          <DailyBrief nothingNeeded={obligations !== null && obligations.length === 0} />
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
 * Life 2 -- the daily brief, REAL as of T16 Phase 3. The "needs me" half of
 * the old plan is the obligations region above (the server owns that set);
 * what remains here is R23's summary.
 *
 * R23 -- A ROLLING 7 DAYS AGAINST THE PRECEDING 7, FIXED, AND THERE IS NO
 * PICKER. Seven days smooths the weekday/weekend swing without hiding a
 * change worth acting on. The picker belongs on SC-12, where a seller goes to
 * ASK a question; Home answers the one they did not ask. Two windowed
 * overview reads (the v1.10 date parameters) supply the pair; ONLY `orders`
 * is windowed on that endpoint, so orders is the compared number and the
 * point-in-time tiles (products, reservations, handoffs, followers) render
 * once as current totals -- comparing a point-in-time count across windows
 * would be a fabricated trend. No client-derived rates: two server numbers,
 * side by side.
 */
function DailyBrief({ nothingNeeded }: { readonly nothingNeeded: boolean }) {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [thisWeek, setThisWeek] = useState<BriefWindow | null>(null);
  const [prevWeek, setPrevWeek] = useState<BriefWindow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    const day = 86400000;
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    const now = Date.now();
    (async () => {
      try {
        // The endpoint's window is INCLUSIVE calendar dates (hi = to + 1 day),
        // so seven DISJOINT days each: this week = the 6 previous calendar
        // days plus today; previous = the 7 before that, ending the day
        // before this week starts. The pass's major: from=now-7d/to=now-7d
        // made the previous window 8 days and counted the boundary day in
        // BOTH numbers -- two honest figures answering a dishonest question.
        const cur = await api<BriefWindow>(
          `/seller/analytics/overview?from=${iso(now - 6 * day)}`,
          { sellerId },
        );
        const prev = await api<BriefWindow>(
          `/seller/analytics/overview?from=${iso(now - 13 * day)}&to=${iso(now - 7 * day)}`,
          { sellerId },
        );
        if (cancelled) return;
        setThisWeek(cur);
        setPrevWeek(prev);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  return (
    <section aria-labelledby="brief-heading" data-brief>
      <h2 id="brief-heading">{en['console.home.brief_title']}</h2>
      {/* T16 S3.1: an empty obligation list is a GOOD state and reads like
          one, beside the summary -- never an empty box. */}
      {nothingNeeded ? (
        <p className="callout" data-nothing-needed>
          {en['console.home.obligations_empty']}
        </p>
      ) : null}
      {failed ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : thisWeek && prevWeek ? (
        <>
          <p className="brief-orders" data-brief-orders>
            {fillTemplate(en['console.home.brief_orders'], {
              n: String(thisWeek.orders),
              prev: String(prevWeek.orders),
            })}
          </p>
          <div className="kpi-tiles">
            {(
              [
                ['console.insights.analytics.products_published', thisWeek.products_published],
                ['console.insights.analytics.active_reservations', thisWeek.active_reservations],
                ['console.insights.analytics.completed_handoffs', thisWeek.completed_handoffs],
                ['console.insights.analytics.followers', thisWeek.followers],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="kpi-tile">
                <span className="kpi-label">{en[key as MessageKey]}</span>
                <span className="kpi-value">{value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** The overview fields the brief renders (suffix-free since v1.10). */
interface BriefWindow {
  readonly products_published: number;
  readonly orders: number;
  readonly active_reservations: number;
  readonly completed_handoffs: number;
  readonly followers: number;
  readonly window: { readonly from: string; readonly to: string };
}
