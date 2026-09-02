/**
 * features/trade/OrderDetail.tsx -- SC-04. "The most important screen in the
 * console" (ADU-CON-03 v1.1 S7), and the six regions in reading order.
 *
 *   1  State and clock       the resolved state, and the governing deadline
 *                            ONLY where one is running
 *   2  Buyer                 name and a contact affordance to SC-21
 *   3  Lines                 product, variant, quantity, price, line state,
 *                            and per-line Can't Fulfil where permitted
 *   4  Payment               submitted time, View evidence, the two decisions
 *   5  Handoff               Mark Ready, courier assignment, custody transfer,
 *                            Show QR -- GATED (R20)
 *   6  History               the append-only transition list, timestamped
 *
 * ==========================================================================
 * R20 -- THE WHOLE HANDOFF REGION REQUIRES PAYMENT_CONFIRMED, AND IT IS
 * DISABLED, NOT HIDDEN
 * ==========================================================================
 * All THREE controls, not only Mark Ready. v1.0 omitted the precondition and
 * "the first wireframe pass duly drew a live Mark Ready on an unpaid order.
 * The omission was here, not in the drawing."
 *
 * "Render, do not hide. The region stays on screen with its controls disabled
 * and one line: handoff opens once the payment is confirmed. A region that
 * disappears makes a seller wonder what they broke; a region that explains
 * itself teaches the sequence."
 *
 * So the region is ALWAYS in the document. `disabled` is the only thing that
 * changes, and the explaining line renders whenever it is off. A test can
 * therefore assert both halves -- present, and not operable -- which a hidden
 * region makes impossible to distinguish from a broken one.
 *
 * ==========================================================================
 * `ready_at` IS A TIMESTAMP, NOT A STATE (ADU-DB-01 S12.6a)
 * ==========================================================================
 * Rendered as a fact in the handoff region -- "Marked ready at 14:20" -- and
 * NEVER in the state badge. A tenth lifecycle stage invented on this screen
 * is one every screen downstream has to interpret.
 *
 * ==========================================================================
 * CONFLICT IS THE STALE-TAB CASE, AND IT COMES FROM THE SERVER
 * ==========================================================================
 * S7: "a seller acting on an order another device already moved sees what
 * state it is actually in, from the server." Two tabs, two phones, a team
 * member. Every action here refetches on both success AND on a 409, so the
 * banner the seller reads is the server's account of what the order is, not
 * this tab's memory of it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { ProblemBanner } from '../../components/Feedback';
import { stateFromProblem, type UiState } from '../../lib/states';
import { formatMinor, fillTemplate, timeFormatter } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import { Deadline, clockFor } from '../../lib/clock';
import { mintKey } from '../../lib/idempotency';
import { useStepUp } from '../../auth/useStepUp';
import { StateBadge, ORDER_STATE_LABEL } from './StateBadge';
import { PaymentDecisions } from './PaymentDecisions';
import { PaymentEvidence } from './PaymentEvidence';
import { HandoffQr } from './HandoffQr';
import {
  isTerminal,
  openSubmission,
  type OrderDetail as Detail,
  type SellerCourierRow,
} from './types';

/** core.reservation_state -> what a seller reads. Unknown values render as code. */
const LINE_STATE_LABEL: Readonly<Record<string, string>> = {
  ACTIVE: en['console.trade.line.active'],
  FULFILLED: en['console.trade.line.fulfilled'],
  CANCELLED_BY_BUYER: en['console.trade.line.cancelled_by_buyer'],
  CANCELLED_BY_SELLER: en['console.trade.line.cancelled_by_seller'],
  REFUNDED: en['console.trade.line.refunded'],
  EXPIRED: en['console.trade.line.expired'],
};

export function OrderDetail() {
  const { sellerId, orderId } = useParams<{ sellerId: string; orderId: string }>();
  const market = useMarketContext();
  const [screen, setScreen] = useState<UiState>('LOADING');
  const [order, setOrder] = useState<Detail | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [modal, setModal] = useState<'evidence' | 'qr' | null>(null);
  const [readyKey] = useState(mintKey);
  const [actionProblem, setActionProblem] = useState<ApiError | null>(null);
  const [reissueKey] = useState(mintKey);
  // D-224.4/D-157: the courier assignment control is live now. Load the
  // seller's couriers; only CLAIMED rows carry an account_id the assignment
  // and custody endpoints can take, and pending invites render disabled with
  // their real status (not a faked selectable row).
  const [couriers, setCouriers] = useState<readonly SellerCourierRow[]>([]);
  const [chosenCourier, setChosenCourier] = useState('');
  const [assignKey] = useState(mintKey);
  const [custodyKey] = useState(mintKey);
  const stepUp = useStepUp();

  const loadCouriers = useCallback(async () => {
    if (!sellerId) return;
    try {
      const r = await api<{ data: SellerCourierRow[] }>(`/seller/couriers`, { sellerId });
      setCouriers(r.data);
    } catch {
      setCouriers([]);
    }
  }, [sellerId]);

  const load = useCallback(async () => {
    if (!sellerId || !orderId) return;
    setScreen((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const d = await api<Detail>(`/seller/orders/${orderId}`, { sellerId });
      setOrder(d);
      setProblem(null);
      // TERMINAL is a property of the ORDER, not of the request: an ended
      // order renders history and no actions (S3).
      setScreen(isTerminal(d.state) ? 'TERMINAL' : 'READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setProblem(e);
        setScreen(stateFromProblem(e.problem));
      } else {
        setProblem(null);
        setScreen('TRANSPORT_ERROR');
      }
    }
  }, [sellerId, orderId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadCouriers();
  }, [loadCouriers]);

  if (!sellerId || !orderId) return null;

  const submission = order ? openSubmission(order) : null;
  const paid = order
    ? ['PAYMENT_CONFIRMED', 'HANDED_OFF', 'COMPLETED'].includes(order.state)
    : false;
  const ended = order ? isTerminal(order.state) : false;

  /**
   * One caller for every POST on this screen. It refetches on success AND on
   * failure, because the most useful thing after a 409 is the state the
   * server actually holds -- which is the stale-tab case S7 names.
   */
  const act = async (path: string, key: string, body?: unknown) => {
    setActionProblem(null);
    try {
      await api(`/seller/orders/${orderId}${path}`, {
        method: 'POST',
        sellerId,
        idempotencyKey: key,
        ...(body === undefined ? {} : { body }),
      });
    } catch (e) {
      if (e instanceof ApiError) setActionProblem(e);
    } finally {
      await load();
    }
  };

  return (
    <main className="screen order-detail">
      <h1>{en['console.trade.detail.title']}</h1>
      <Link to=".." relative="path" className="back">
        {en['console.trade.detail.back']}
      </Link>

      <ScreenState
        state={screen}
        {...(problem ? { problem: problem.problem } : {})}
        onRetry={() => void load()}
      >
        {order ? (
          <>
            {/* A failed ACTION is not a failed screen: the order is still on
                screen and still correct. Rendered here rather than swapping
                the whole screen for a banner. */}
            {actionProblem ? <ProblemBanner problem={actionProblem.problem} /> : null}

            {/* ---------------------------------------------- 1. state + clock */}
            <section className="region state-region" aria-labelledby="r-state">
              <h2 id="r-state">{en['console.trade.detail.state_heading']}</h2>
              <StateBadge state={order.state} />
              {/* "only where one is running" -- <Deadline> renders null for
                  NONE, so there is no clock region on a paid order at all. */}
              <Deadline
                clock={clockFor({
                  state: order.state,
                  expires_at: order.expires_at,
                  payment_sla_deadline: submission?.sla_deadline ?? null,
                })}
                onElapsed={() => void load()}
              />
            </section>

            {/* ---------------------------------------------------- 2. buyer */}
            <section className="region buyer-region" aria-labelledby="r-buyer">
              <h2 id="r-buyer">{en['console.trade.detail.buyer_heading']}</h2>
              {/*
                D-153. There is no name in the data model to render, and S7
                forbids the substitute in the same breath as asking for the
                name: "Never a raw phone number where a conversation exists."
                So the region states the absence and offers the conversation,
                which is the affordance S7 actually routes to (SC-21).
              */}
              <p className="hint" data-gap="D-153">
                {en['console.trade.detail.no_buyer_name']}
              </p>
              <Link className="contact-buyer" to="../../inbox" relative="path">
                {en['console.trade.detail.contact_buyer']}
              </Link>
            </section>

            {/* ---------------------------------------------------- 3. lines */}
            <section className="region lines-region" aria-labelledby="r-lines">
              <h2 id="r-lines">{en['console.trade.detail.lines_heading']}</h2>
              <ul className="order-lines">
                {order.lines.map((l) => (
                  <li key={l.id} data-line={l.id} data-line-state={l.state}>
                    <span className="line-product">{l.product_name}</span>
                    <span className="line-variant">{l.variant_key}</span>
                    <span className="line-qty">
                      {fillTemplate(en['console.trade.detail.quantity'], {
                        count: String(l.quantity),
                      })}
                    </span>
                    <span className="line-price">
                      {market ? formatMinor(market, Number(l.unit_price_minor)) : ''}
                    </span>
                    {/* A label, not the raw enum (T11 Phase 5, D-171):
                        core.reservation_state values rendered verbatim are
                        untranslated seller-visible text that never entered
                        the catalogue -- so the missing-Amharic-is-a-compile-
                        error guarantee silently did not apply to them. An
                        unknown value renders as its code, the Home/StateBadge
                        precedent. */}
                    <span className="line-state">{LINE_STATE_LABEL[l.state] ?? l.state}</span>
                    {/*
                      "Per-line Can't Fulfil where permitted." THERE IS NO
                      ACCEPT-RESERVATION COUNTERPART, and there must not be:
                      it is one of the eleven load-bearing absences, and the
                      API's own summary says so -- "There is no accept action."
                      Withheld once the order has ended, where nothing is
                      actionable.
                    */}
                    {!ended && l.state === 'ACTIVE' ? (
                      <CantFulfil
                        onCancel={(key) => act(`/reservations/${l.id}/cancel`, key)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {/* -------------------------------------------------- 4. payment */}
            <section className="region payment-region" aria-labelledby="r-payment">
              <h2 id="r-payment">{en['console.trade.detail.payment_heading']}</h2>
              {order.payment_submissions.length === 0 ? (
                <p className="empty">{en['console.trade.detail.no_submission']}</p>
              ) : (
                <>
                  <p className="submitted-at">
                    {market && order.payment_submissions[0]
                      ? timeFormatter(market).format(
                          new Date(order.payment_submissions[0].submitted_at),
                        )
                      : ''}
                  </p>
                  <button
                    type="button"
                    data-action="view-evidence"
                    onClick={() => setModal('evidence')}
                  >
                    {en['console.trade.detail.view_evidence']}
                  </button>
                </>
              )}
              {/*
                The two decisions, on the screen and in the modal, from ONE
                component. Offered only while a submission is open -- after a
                decision there is nothing left to decide, and a live Confirm
                on a confirmed order is a second irreversible act.
              */}
              {submission ? (
                <PaymentDecisions
                  sellerId={sellerId}
                  orderId={orderId}
                  onDecided={() => void load()}
                  idPrefix="detail"
                />
              ) : null}

              {/*
                REISSUE PAYMENT INSTRUCTIONS -- the one step-up-protected
                action in C-4's surface, and the first real caller of
                useStepUp. It is `challengeRequired` because `reissueBody`
                declares step_up_challenge_id as a required uuid: calling
                without one earns a 400 from zod, never the 403 that the
                interception path is for. Both doors end in the same retry.

                OFFERED ONLY IN THE STATES fn_reissue_instructions ACCEPTS --
                CREATED, NOTIFIED, PAYMENT_SUBMITTED (migration 0022, "order
                is not payable" otherwise). The first version withheld it only
                on `ended`, so PAYMENT_CONFIRMED and HANDED_OFF rendered an
                enabled control the database always refuses (T11 Phase 5,
                D-170) -- and because this action is challengeRequired, the
                seller spent an OTP and six digits BEFORE the refusal arrived.
                A control the server will refuse must not cost a step-up to
                find out. Absent rather than disabled: unlike R20's handoff
                region, this is not "opens later in the sequence" -- once
                payment is confirmed there are no instructions to reissue,
                ever, so a disabled control would teach a seller to wait for
                something that never comes.
              */}
              {['CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED'].includes(order.state) ? (
                <>
                  <button
                    type="button"
                    data-action="reissue-instructions"
                    onClick={() =>
                      void stepUp
                        .guard(
                          'REISSUE_INSTRUCTIONS',
                          orderId,
                          async (challengeId) => {
                            await api(`/seller/orders/${orderId}/reissue-instructions`, {
                              method: 'POST',
                              sellerId,
                              idempotencyKey: reissueKey,
                              body: { step_up_challenge_id: challengeId },
                            });
                          },
                          { challengeRequired: true },
                        )
                        .then(
                          () => void load(),
                          (e: unknown) => {
                            if (e instanceof ApiError) setActionProblem(e);
                          },
                        )
                    }
                  >
                    {en['console.trade.detail.reissue']}
                  </button>
                  <p className="hint">{en['console.trade.detail.reissue_hint']}</p>
                </>
              ) : null}
            </section>

            {/* -------------------------------------------------- 5. handoff */}
            {/*
              R20. ALWAYS RENDERED. `disabled` is the only thing state
              changes, and the explaining line appears whenever it is off.
            */}
            <section className="region handoff-region" aria-labelledby="r-handoff" data-gated={String(!paid)}>
              <h2 id="r-handoff">{en['console.trade.detail.handoff_heading']}</h2>
              {!paid ? (
                <p className="hint" data-gate="R20">
                  {en['console.trade.detail.handoff_locked']}
                </p>
              ) : null}

              {/* `ready_at` as a FACT, never as a state badge. */}
              {order.ready_at && market ? (
                <p className="ready-fact" data-ready-at={order.ready_at}>
                  {fillTemplate(en['console.trade.detail.marked_ready'], {
                    time: timeFormatter(market).format(new Date(order.ready_at)),
                  })}
                </p>
              ) : null}

              {/*
                D-155 + R20 held together. The handoff REGION and its controls
                RENDER whenever the order exists (R20: a region that
                disappears makes a seller wonder what they broke) -- but each
                control is ENABLED iff the server's allowed_actions carries
                its permission code. allowed_actions already encodes BOTH the
                state gate and the grant gate, so the console reads ONE array
                and never unions its own guess: an ANALYST on a confirmed
                order sees the controls disabled, a pre-payment OWNER sees
                them disabled, and only a confirmed OWNER acts.
              */}
              <div className="handoff-controls">
                <button
                  type="button"
                  data-action="mark-ready"
                  disabled={!order.allowed_actions.includes('seller.order_ready:update')}
                  onClick={() => void act('/ready', readyKey)}
                >
                  {en['console.trade.detail.mark_ready']}
                </button>
                {/*
                  D-157/D-224.4: courier assignment is LIVE. The couriers
                  endpoint returns claimed rows with account_id now; the
                  select offers only claimed couriers, and a pending invite
                  shows disabled with its real status rather than a faked
                  selectable row.
                */}
                <div className="courier-assign">
                  <label htmlFor="courier-select" className="visually-hidden">
                    {en['console.trade.detail.assign_courier']}
                  </label>
                  <select
                    id="courier-select"
                    value={chosenCourier}
                    disabled={!order.allowed_actions.includes('seller.couriers:manage')}
                    onChange={(e) => setChosenCourier(e.target.value)}
                  >
                    <option value="">{en['console.trade.detail.courier_choose']}</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.account_id ?? ''} disabled={c.account_id === null}>
                        {c.account_id
                          ? c.phone
                          : fillTemplate(en['console.trade.detail.courier_pending'], {
                              phone: c.phone,
                            })}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-action="assign-courier"
                    disabled={
                      !order.allowed_actions.includes('seller.couriers:manage') || !chosenCourier
                    }
                    onClick={() =>
                      void act('/courier-assignment', assignKey, {
                        courier_account_id: chosenCourier,
                      })
                    }
                  >
                    {en['console.trade.detail.assign_courier']}
                  </button>
                </div>
                <button
                  type="button"
                  data-action="custody-transfer"
                  disabled={
                    !order.allowed_actions.includes('seller.handoff:custody_transfer') ||
                    !chosenCourier
                  }
                  onClick={() =>
                    void act('/custody-transfer', custodyKey, {
                      courier_account_id: chosenCourier,
                    })
                  }
                >
                  {en['console.trade.detail.custody_transfer']}
                </button>
                <button
                  type="button"
                  data-action="show-qr"
                  disabled={!order.allowed_actions.includes('seller.handoff:read')}
                  onClick={() => setModal('qr')}
                >
                  {en['console.trade.detail.show_qr']}
                </button>
              </div>
            </section>

            {/* -------------------------------------------------- 6. history */}
            <section className="region history-region" aria-labelledby="r-history">
              <h2 id="r-history">{en['console.trade.detail.history_heading']}</h2>
              {order.history.length === 0 ? (
                <p className="empty">{en['console.trade.detail.no_history']}</p>
              ) : (
                <ol className="history">
                  {order.history.map((t) => (
                    <li key={`${t.occurred_at}-${t.to_state}`} data-transition={t.to_state}>
                      <span className="history-when">
                        {market ? timeFormatter(market).format(new Date(t.occurred_at)) : ''}
                      </span>
                      {/* PLAIN LANGUAGE, not "NOTIFIED -> PAYMENT_SUBMITTED".
                          A whole sentence with a named slot, so the word order
                          belongs to the translator (S4.5). */}
                      <span className="history-what">
                        {fillTemplate(en['console.trade.detail.history_entry'], {
                          state: ORDER_STATE_LABEL[t.to_state] ?? t.to_state,
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </ScreenState>

      {modal === 'evidence' && order ? (
        <PaymentEvidence
          sellerId={sellerId}
          orderId={orderId}
          submittedAt={order.payment_submissions[0]?.submitted_at ?? null}
          decidable={submission !== null}
          onDecided={() => {
            setModal(null);
            void load();
          }}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === 'qr' ? (
        <HandoffQr sellerId={sellerId} orderId={orderId} onClose={() => setModal(null)} />
      ) : null}
      {/* SC-31 over SC-04. Rendered by the hook, opened by the hook, and this
          screen knows nothing about codes or challenges. */}
      {stepUp.modal}
    </main>
  );
}

/**
 * "Can't Fulfil", with its idempotency key minted ON MOUNT. A key minted in
 * the click handler is a new key per tap -- exactly the retry the header
 * exists to defeat -- and this control cancels a line irreversibly.
 */
function CantFulfil({ onCancel }: { readonly onCancel: (key: string) => void }) {
  const [key] = useState(mintKey);
  return (
    <button type="button" data-action="cant-fulfil" onClick={() => onCancel(key)}>
      {en['console.trade.detail.cant_fulfil']}
    </button>
  );
}
