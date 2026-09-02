import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { sql } from 'kysely';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { assertPermission } from '../../common/auth/permission';
import { grantSet } from '../../common/auth/grant-set';

/**
 * GET /v1/seller/obligations -- ADU-API-01 v1.10 S12.12b. WHAT NEEDS ME.
 *
 * THE SERVER OWNS THE OBLIGATION SET, for the same reason it owns the order
 * buckets (D-154): "needs me" is not a state, it is a set of situations
 * across several objects, and which situations belong is a product decision.
 * A console assembling this list would be deciding what counts.
 *
 * THE ADMISSION TEST -- an obligation is a thing where SILENCE COSTS YOU.
 * A payout change activating in 24 hours is PENDING, not owed: nothing is
 * required and it happens either way. Pending states are excluded, because a
 * list that mixes "you must act" with "this is happening" becomes a list
 * people learn to ignore. Three kinds pass the test (register D-235 applies
 * it to every candidate, including the rejected ones):
 *
 *   PAYMENT_AWAITING_CONFIRMATION  deadline: payment_submission.sla_deadline
 *     (STORED absolute -- the same field SC-03's confirmation clock renders,
 *     one source, no drift; fn_confirmation_window_lapse is the authority at
 *     the lapse). Consequence, TRUE per that function: a SYSTEM SLA_BREACH
 *     claim opens, and missed_confirmation_windows / unresolved_claim_count
 *     -- both PUBLIC on the storefront -- are incremented. Stock stays held.
 *
 *   CLAIM_AWAITING_SELLER  deadline: claim.review_deadline (stored absolute).
 *     No job fires at it -- it is the operator's review horizon -- but past
 *     it the claim can be decided without the seller's side, and an upheld
 *     claim recomputes the level with the claim counted.
 *
 *   ORDER_NOT_READY  deadline: DERIVED, clock_stopped_at + the market's
 *     timing_config.fulfilment_window (clock_stopped_at IS the confirmation
 *     instant; core."order".fulfilment_deadline is never written by anything
 *     -- D-235). Included FROM confirmation, deadline approaching, exactly as
 *     the payment entry warns before its deadline; an overdue entry stays.
 *     The consequence the DATABASE actually delivers is a buyer's
 *     goods-not-received claim exposure and a standing deletion blocker --
 *     NOT "the order expires and stock releases", which no job implements
 *     (D-235 reports that discrepancy; the sentence rendered is the true one).
 *
 * ORDERED BY DEADLINE, NEAREST FIRST -- overdue entries sort first naturally.
 * An empty list is a real answer: 200 { data: [] }, never an error.
 *
 * Each entry: a typed `kind` (never prose the client parses), the object
 * (`object_kind` + `object_id` -- the ROUTE that opens it is the console's
 * kind->route mapping, the ACTION_ROUTE precedent Home already uses for
 * readiness, because a URL is a client artifact and the Companion's routes
 * differ), the absolute `deadline` (the console renders it and decides
 * NOTHING -- at zero a clock refetches), and `consequence_key` -- derived
 * S7.2-style from the kind, carried explicitly the way error envelopes carry
 * message_key, so the console renders the server's sentence and composes
 * nothing.
 *
 * AUTHORIZATION: the door is seller.store:read (CONSOLE-only surface, held by
 * every seller role; a stranger is 404 via U0002). Entries are then FILTERED
 * by the caller's grant set (grantSet -- the D-155 read-only machinery, which
 * never authorizes and never raises): ORDER entries require
 * seller.orders:read, CLAIM entries seller.claims:read. A role that cannot
 * read claims must not learn from this list that a claim exists.
 */

type ObligationKind = 'PAYMENT_AWAITING_CONFIRMATION' | 'CLAIM_AWAITING_SELLER' | 'ORDER_NOT_READY';

/** The grant each object kind's entries require the caller to hold. */
const KIND_GRANT: Record<'ORDER' | 'CLAIM', string> = {
  ORDER: 'seller.orders:read',
  CLAIM: 'seller.claims:read',
};

@Controller()
export class ObligationsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Get('seller/obligations')
  @ApiOperation({ summary: 'What the seller owes, with deadlines. The server owns the set (S12.12b).' })
  async list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      await assertPermission(trx, req, 'seller.store:read');
      const sellerId = req.ctx?.sellerId;

      const r = await sql<{
        kind: ObligationKind;
        object_kind: 'ORDER' | 'CLAIM';
        object_id: string;
        deadline: Date;
        lapsed: boolean;
      }>`
        WITH cfg AS (
          SELECT tc.fulfilment_window
            FROM core.timing_config tc
            JOIN core.seller s ON s.market_id = tc.market_id
           WHERE s.id = ${sellerId} AND tc.effective @> now()
        )
        SELECT * FROM (
          -- A submitted payment the seller has not decided. The deadline is
          -- the submission's own stored sla_deadline -- the field the
          -- confirmation clock already renders, so the list and the clock
          -- cannot disagree. (The IS NOT NULL filter guards test fixtures
          -- only: the prod path cannot write NULL -- the window is NOT NULL
          -- -- and commitEvidence now fails loudly rather than inserting
          -- zero rows when no config is in force; Phase 2 pass F2.)
          --
          -- THE POST-LAPSE SHAPE (pass F1, the work order's exact warned
          -- failure): fn_confirmation_window_lapse leaves the order in
          -- PAYMENT_SUBMITTED, so after a miss this entry STAYS -- overdue,
          -- sorted first, and the payment decision genuinely still owed --
          -- while the SYSTEM claim lists separately. But the pre-lapse
          -- sentence ("a claim opens automatically...") would then promise,
          -- in the future tense and forever, exactly what already happened
          -- and cannot happen again (the one-open-claim guard). The lapsed
          -- flag switches the entry to its own consequence key -- which is
          -- the reason consequence_key rides the wire explicitly.
          SELECT 'PAYMENT_AWAITING_CONFIRMATION' AS kind, 'ORDER' AS object_kind,
                 o.id AS object_id, ps.sla_deadline AS deadline,
                 EXISTS (
                   SELECT 1 FROM core.claim lc
                    WHERE lc.order_id = o.id
                      AND lc.trigger = 'SLA_BREACH'
                      AND lc.outcome IS NULL
                 ) AS lapsed
            FROM core."order" o
            JOIN LATERAL (
              SELECT p.sla_deadline
                FROM core.payment_submission p
               WHERE p.order_id = o.id AND p.state = 'SUBMITTED'
               ORDER BY p.submitted_at DESC
               LIMIT 1
            ) ps ON true
           WHERE o.seller_id = ${sellerId}
             AND o.state = 'PAYMENT_SUBMITTED'
             AND ps.sla_deadline IS NOT NULL
          UNION ALL
          -- A claim waiting on the seller's side. outcome IS NULL is the
          -- open-claim predicate the lapse function itself uses.
          SELECT 'CLAIM_AWAITING_SELLER', 'CLAIM', c.id, c.review_deadline, false AS lapsed
            FROM core.claim c
            JOIN core."order" o ON o.id = c.order_id
           WHERE o.seller_id = ${sellerId}
             AND c.state = 'AWAITING_SELLER_EVIDENCE'
             AND c.outcome IS NULL
          UNION ALL
          -- A paid order not yet marked ready. Derived deadline: the
          -- confirmation instant plus the market's fulfilment window. Where
          -- no timing config is in force the arm yields nothing -- this is a
          -- HINT list, not a write guard, so unlike the payout lock it does
          -- not fail closed (registered choice, D-235).
          SELECT 'ORDER_NOT_READY', 'ORDER', o.id,
                 o.clock_stopped_at + (SELECT fulfilment_window FROM cfg), false AS lapsed
            FROM core."order" o
           WHERE o.seller_id = ${sellerId}
             AND o.state = 'PAYMENT_CONFIRMED'
             AND o.ready_at IS NULL
             AND o.clock_stopped_at IS NOT NULL
             AND EXISTS (SELECT 1 FROM cfg)
        ) obligations
        ORDER BY deadline ASC`.execute(trx);

      const grants = await grantSet(trx, req);
      const data = r.rows
        .filter((row) => grants.has(KIND_GRANT[row.object_kind]))
        .map((row) => ({
          kind: row.kind,
          object_kind: row.object_kind,
          object_id: row.object_id,
          deadline: row.deadline.toISOString(),
          // Post-lapse, the pre-lapse promise would be a standing lie; the
          // lapsed variant says what is true now (pass F1).
          consequence_key: row.lapsed
            ? `obligation.${row.kind.toLowerCase()}.consequence_lapsed`
            : `obligation.${row.kind.toLowerCase()}.consequence`,
        }));
      return { data };
    });
  }
}
