/**
 * lib/clock.tsx -- THE THREE CLOCK TREATMENTS, IN ONE PLACE.
 *
 * ==========================================================================
 * WHY THIS IS A MODULE AND NOT THREE `if`s INSIDE TWO SCREENS
 * ==========================================================================
 * SC-03's row and SC-04's clock region must agree, and the failure they
 * would produce if they drifted is not cosmetic: a list that says an order
 * has four hours left and a detail screen that says it expired yesterday
 * teaches a seller that neither number is real. Two screens implementing
 * "the clock that matters in the current state" separately is two chances
 * to get the mapping wrong; this is one.
 *
 * ==========================================================================
 * ADU-CON-03 S7, verbatim in effect
 * ==========================================================================
 *   CREATED / NOTIFIED        the RESERVATION window   (order.expires_at)
 *   PAYMENT_SUBMITTED         the CONFIRMATION window  (submission sla_deadline)
 *                             -- "and the reservation clock is irrelevant"
 *   PAYMENT_CONFIRMED and on  NO COUNTDOWN AT ALL
 *
 * The third is the one with teeth. S7: "a running timer on a paid order is
 * the single most misleading thing this screen could display." It is not a
 * stopped timer, not a greyed timer, not "0:00" -- the region is absent, and
 * `clock_stopped_at` on the row is the server's own statement that the clock
 * has stopped permanently (order_clock_consistency makes it NOT NULL for
 * every state from PAYMENT_CONFIRMED onward).
 *
 * ==========================================================================
 * THE CLIENT COMPUTES NO BUSINESS STATE (S3.1), AND THIS IS WHERE THAT RULE
 * IS EASIEST TO BREAK
 * ==========================================================================
 * `if (Date.now() > order.expiresAt)` is the defining violation. A clock that
 * decides is a clock that expires an order in a browser whose system time is
 * wrong, on a laptop that was asleep, in a tab left open overnight -- and the
 * seller then acts on a state the server has never heard of.
 *
 * So this file draws a hard line:
 *
 *   DISPLAYING remaining time from a server-supplied deadline   -- allowed,
 *     and S3.1 names it: "a countdown may DISPLAY a server deadline".
 *   DECIDING anything when it reaches zero                      -- forbidden.
 *
 * At zero the countdown calls `onElapsed` and the screen REFETCHES. What the
 * order becomes is the server's answer, arriving the only way it ever does.
 * Nothing in this module returns a state, hides a control, or disables one.
 */
import { useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { fillTemplate } from './intl';
import { useMarket } from './market';

/** Every order state the seller console can be shown. ADU-DB-01 S12. */
export type OrderState =
  | 'CREATED'
  | 'NOTIFIED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_CONFIRMED'
  | 'HANDED_OFF'
  | 'COMPLETED'
  | 'CANCELLED_BY_BUYER'
  | 'CANCELLED_BY_SELLER'
  | 'EXPIRED_UNCLAIMED';

/**
 * WHICH clock, and which server field carries it. `kind` exists so a test can
 * assert the treatment rather than infer it from rendered minutes, and so the
 * "no countdown" case is a value rather than the absence of one.
 */
export type Clock =
  | { readonly kind: 'RESERVATION'; readonly deadline: string }
  | { readonly kind: 'CONFIRMATION'; readonly deadline: string }
  | { readonly kind: 'NONE' };

export interface ClockSource {
  readonly state: OrderState;
  readonly expires_at: string | null;
  /** The open submission's sla_deadline. Null unless one is open. */
  readonly payment_sla_deadline: string | null;
}

/**
 * The mapping, and the whole of it. A pure function of what the server sent:
 * no clock arithmetic, no comparison against the browser's clock, no state.
 */
export function clockFor(o: ClockSource): Clock {
  switch (o.state) {
    case 'CREATED':
    case 'NOTIFIED':
      return o.expires_at ? { kind: 'RESERVATION', deadline: o.expires_at } : { kind: 'NONE' };
    case 'PAYMENT_SUBMITTED':
      /*
       * NOT a fallback to expires_at. If the confirmation deadline is missing
       * the honest rendering is NO CLOCK -- the reservation window is
       * "irrelevant" here (S7), and showing an irrelevant deadline as though
       * it governed is worse than showing none. The seed order in this state
       * deliberately carries an expires_at in the PAST, so a fallback would
       * render a negative countdown and the harness would see it.
       */
      return o.payment_sla_deadline
        ? { kind: 'CONFIRMATION', deadline: o.payment_sla_deadline }
        : { kind: 'NONE' };
    default:
      // PAYMENT_CONFIRMED, HANDED_OFF, COMPLETED, both cancellations and
      // EXPIRED_UNCLAIMED. No countdown at all.
      return { kind: 'NONE' };
  }
}

/** The label naming WHICH deadline this is. A bare countdown says nothing. */
const CLOCK_LABEL: Readonly<Record<'RESERVATION' | 'CONFIRMATION', string>> = {
  RESERVATION: en['console.trade.clock.reservation'],
  CONFIRMATION: en['console.trade.clock.confirmation'],
};

/**
 * THE COUNTDOWN MEASURES AGAINST THE SERVER'S CLOCK, NOT THE DEVICE'S.
 *
 * /v1/bootstrap returns `server_time` and MarketProvider records the moment
 * this client received it, precisely so a screen showing "time remaining" has
 * a reference that is not the local system clock (the A5 rule). A device
 * whose clock is hours off is ordinary -- a phone that lost its network, a
 * laptop restored from an image -- and a countdown computed from it is wrong
 * by exactly that much, silently, on the screen where the number matters.
 *
 * The skew is applied as an OFFSET rather than by re-reading server_time,
 * because the two clocks tick at the same rate; only their origins differ.
 * With no bootstrap yet (`null`) the offset is zero and this degrades to the
 * device clock, which is the honest fallback: still a display, still never a
 * decision.
 */
function useServerSkew(): number {
  const { serverTime } = useMarket();
  if (!serverTime) return 0;
  const skew = Date.parse(serverTime.at) - serverTime.receivedAt;
  return Number.isFinite(skew) ? skew : 0;
}

/**
 * Whole hours and minutes remaining, or null once the deadline has passed.
 * Exported for the tick, not for a decision -- see the module header.
 */
function remaining(deadlineIso: string, nowMs: number): { h: number; m: number } | null {
  const ms = Date.parse(deadlineIso) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000) };
}

/**
 * THE ONCE-ONLY GUARD LIVES ABOVE THE COMPONENT, IN MODULE STATE (T11 Phase
 * 4, D-167). It was a ref -- and a ref dies with its component. The thing
 * onElapsed causes (a refetch) used to cause the component's own remount
 * (ScreenState rebuilt its subtree on every READY<->STALE flip), so the ref
 * reset and the "once" fired again, forever: ~68 requests/second measured on
 * any order whose displayed deadline was already past.
 *
 * IF THE THING A GUARD PREVENTS CAN CAUSE THE GUARD'S OWN REMOUNT, IT IS NOT
 * A GUARD. ScreenState no longer remounts on that flip (the other half of
 * the fix), but this module does not rely on it: a deadline string fires
 * onElapsed AT MOST ONCE PER PAGE LIFE, whatever mounts and unmounts around
 * it. Two independent controls; neither trusted alone.
 *
 * Correctness of at-most-once-per-page-life: a deadline that has passed
 * before a later mount needs no elapsed refetch -- the mount's own initial
 * load already fetched post-deadline truth. A NEW deadline (a new
 * submission's window) is a new string and fires again. The set holds
 * short strings and grows by one per deadline ever displayed; a page life
 * displays a handful.
 */
const elapsedFired = new Set<string>();

interface DeadlineProps {
  readonly clock: Clock;
  /**
   * Called at most once PER DEADLINE STRING PER PAGE LIFE, when the displayed
   * deadline passes. The screen refetches; this component neither knows nor
   * guesses what the order becomes.
   */
  readonly onElapsed?: () => void;
}

/**
 * The countdown. Renders nothing at all for `NONE` -- not an empty element,
 * not a placeholder -- so a paid order's row has no clock region to mistake
 * for a stopped one.
 */
export function Deadline({ clock, onElapsed }: DeadlineProps) {
  // A NUMBER, not a closure: a function re-created every render cannot sit in
  // a dependency array honestly, and the alternative -- suppressing the
  // lint -- names a rule this repository's eslint config does not even load,
  // so the suppression would be a comment that silences nothing.
  const skew = useServerSkew();
  const [now, setNow] = useState(() => Date.now() + skew);

  const deadline = clock.kind === 'NONE' ? null : clock.deadline;

  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now() + skew);
    // Once a minute: this displays hours and minutes, and a per-second timer
    // would wake the tab sixty times for each change a person can see.
    const id = setInterval(() => setNow(Date.now() + skew), 60_000);
    return () => clearInterval(id);
  }, [deadline, skew]);

  useEffect(() => {
    if (!deadline || elapsedFired.has(deadline)) return;
    if (remaining(deadline, now) === null) {
      // Marked BEFORE the callback: onElapsed sets parent state, and marking
      // after would leave a window where a re-render re-enters this effect.
      elapsedFired.add(deadline);
      // REFETCH, not a local transition. Everything the screen shows after
      // this moment is the server's answer.
      onElapsed?.();
    }
  }, [deadline, now, onElapsed]);

  if (clock.kind === 'NONE') return null;

  const left = remaining(clock.deadline, now);
  return (
    <span className="deadline" data-clock={clock.kind}>
      <span className="deadline-label">{CLOCK_LABEL[clock.kind]}</span>{' '}
      <span className="deadline-value">
        {left === null
          ? // Past the deadline and the refetch has not yet answered. It says
            // the time has passed; it does NOT say what the order now is.
            en['console.trade.clock.elapsed']
          : fillTemplate(en['console.trade.clock.remaining'], {
              hours: String(left.h),
              minutes: String(left.m),
            })}
      </span>
    </span>
  );
}
