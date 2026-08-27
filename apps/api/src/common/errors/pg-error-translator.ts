import { AdulisException, notFound, type ErrorItem } from './adulis-exception';
import { messageKeyFor, type ErrorCode } from './error-catalogue';

/**
 * ADU-CON-02 v3.0 section 6.3 / ADU-API-01 v1.6 section 7.1a — Postgres
 * errors translate MECHANICALLY. This is that table as code, and the whole
 * argument for database-enforced invariants pays off here: the database
 * raises one honest signal, and this file is the single place it becomes an
 * envelope.
 *
 * The three-SQLSTATE authorization contract (R29), verbatim:
 *
 *   U0001  fn_has_permission / boundary reads   -> 403 PERMISSION_DENIED
 *   U0002  fn_has_permission                    -> 404, ordinary envelope
 *   42501  PostgreSQL itself                    -> 500. A grant is
 *          misconfigured — OUR defect, logged loudly, never a 403: a
 *          deliberate denial and a misconfigured grant never share a code,
 *          or a real privilege bug surfaces as a clean denial and is never
 *          investigated.
 *
 * Anything this table does not recognise is a 500: an unanticipated database
 * refusal means the API let something through that the schema had to stop,
 * and that is a defect to surface, not a conflict to soften.
 */

/** The shape `pg` raises. Structural, so tests can fabricate one. */
export interface PgError {
  readonly code?: string;
  readonly message: string;
  readonly detail?: string;
  readonly constraint?: string;
}

export function isPgError(e: unknown): e is PgError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as { code?: unknown }).code === 'string' &&
    'message' in e
  );
}

/**
 * The four composite foreign keys that make cross-buyer and cross-seller
 * errors STRUCTURALLY impossible (Appendix C check 9), plus the claim-scope
 * FK. A violation of any of them is a scope failure: 404, no detail —
 * an actor probing another's object must not learn that it exists
 * (ADU-AUTH-01 S19/S21).
 */
const SCOPE_FK_CONSTRAINTS = new Set([
  'cart_line_variant_seller',
  'cart_line_single_seller',
  'handoff_scanned_by_buyer',
  'review_by_order_buyer',
  'claim_line_belongs_to_order',
]);

/** Section 8.3's resolving actions, derivable from the item itself. */
function resolvingActionFor(item: {
  code?: string;
  available?: number;
}): ErrorItem['resolving_action'] {
  if (item.code === 'PRICE_CHANGED') return { kind: 'ACCEPT_NEW_PRICE' };
  if (item.code === 'INSUFFICIENT_STOCK' && typeof item.available === 'number') {
    return { kind: 'REDUCE_QUANTITY', to: item.available };
  }
  if (item.code === 'SOLD_OUT' || item.code === 'VARIANT_WITHDRAWN' ||
      item.code === 'NO_LONGER_PUBLISHED') {
    return { kind: 'REMOVE_LINE' };
  }
  return undefined;
}

/**
 * U0003's DETAIL is the complete items[] as JSON — the function raises ONCE
 * with every failing line (section 7's completeness invariant: the buyer
 * sees everything that changed at once, not one failure per retry).
 */
function itemsFromDetail(detail: string | undefined): ErrorItem[] {
  if (!detail) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((raw): ErrorItem[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const { code, variant_id, ...slots } = raw as Record<string, unknown> & {
      code?: string;
      variant_id?: string;
    };
    if (typeof code !== 'string') return [];
    return [
      {
        code,
        subject:
          typeof variant_id === 'string'
            ? { kind: 'CART_LINE', id: variant_id }
            : undefined,
        // Item codes live in the cart_line group (section 7.1's table).
        message_key: messageKeyFor(code as ErrorCode),
        slots,
        resolving_action: resolvingActionFor(raw as { code?: string; available?: number }),
      },
    ];
  });
}

const ILLEGAL_TRANSITION_RE = /Illegal (?:order|reservation) transition (\S+) -> (\S+)/;

/**
 * Translate a database refusal into the one deliberate exception. Returns
 * null where the error is not a recognised refusal — the filter then serves
 * a 500, because an unmapped database error is our defect by definition.
 */
export function translatePgError(e: PgError): AdulisException | null {
  switch (e.code) {
    case 'U0001':
      // One message earns a more specific 403: the S16.9 owner rule. The
      // matrix already restricts seller.account:delete to the Owner, so
      // this fires only if the matrix is ever widened - which is the point.
      if (e.message.includes('deletion owner only')) {
        return new AdulisException('DELETION_OWNER_ONLY');
      }
      return new AdulisException('PERMISSION_DENIED');

    case 'U0002':
      // The ordinary not-found envelope, with no hint a permission was
      // involved. Telling a caller which gate stopped them tells an
      // attacker which one to work on.
      return notFound();

    // The step-up band (register D-23): distinct failure modes reach the
    // wire as the distinct codes section 7.1 already rules.
    case 'U0004':
      return new AdulisException('STEP_UP_REQUIRED');
    case 'U0005':
      return new AdulisException('STEP_UP_EXPIRED');
    case 'U0006':
      return new AdulisException('STEP_UP_ACTION_MISMATCH');

    // The payout locks (register D-28): recovery cooling and the
    // new-device lock share the one taxonomy code; the reason is a slot.
    case 'U0008': {
      let slots: Record<string, unknown> | undefined;
      try {
        slots = e.detail ? (JSON.parse(e.detail) as Record<string, unknown>) : undefined;
      } catch {
        slots = undefined;
      }
      return new AdulisException('PAYOUT_LOCKED_RECOVERY', { slots });
    }

    // The buyer-cancellation cooldown (register D-26): the until-timestamp
    // travels in DETAIL as typed slots, never prose.
    case 'U0007': {
      let slots: Record<string, unknown> | undefined;
      try {
        slots = e.detail ? (JSON.parse(e.detail) as Record<string, unknown>) : undefined;
      } catch {
        slots = undefined;
      }
      return new AdulisException('BUYER_COOLDOWN_ACTIVE', { slots });
    }

    case 'U0003':
      return new AdulisException('CART_REVALIDATION_FAILED', {
        items: itemsFromDetail(e.detail),
      });

    // The transition guards (restrict_violation). Both states travel in
    // slots so a client can act on the conflict by refetching.
    case '23001': {
      const m = ILLEGAL_TRANSITION_RE.exec(e.message);
      if (m) {
        return new AdulisException('ILLEGAL_TRANSITION', {
          slots: { from_state: m[1], to_state: m[2] },
        });
      }
      if (e.message.includes('not in a readyable state')) {
        return new AdulisException('ORDER_NOT_READYABLE');
      }
      if (e.message.includes('scan predates its token')) {
        return new AdulisException('SCAN_PREDATES_TOKEN');
      }
      if (e.message.includes('payment already decided')) {
        return new AdulisException('PAYMENT_ALREADY_DECIDED');
      }
      if (e.message.includes('payout change already pending')) {
        return new AdulisException('PAYOUT_CHANGE_PENDING');
      }
      if (e.message.includes('order is not payable')) {
        return new AdulisException('ORDER_NOT_PAYABLE');
      }
      if (e.message.includes('no active payout details')) {
        return new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'NO_ACTIVE_PAYOUT' },
        });
      }
      if (e.message.includes('not in a refundable state')) {
        return new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'LINE_NOT_REFUNDABLE' },
        });
      }
      if (e.message.includes('deletion blocked')) {
        // The endpoint surfaces blockers with items[] before calling; this
        // branch is the in-function re-check winning a race.
        return new AdulisException('DELETION_BLOCKED');
      }
      if (e.message.includes('publication blocked') || e.message.includes('publication limit')) {
        // handled endpoint-side with items[]; reaching here means a caller
        // outside the publish handler tripped it - still a 409.
        return new AdulisException('PUBLICATION_BLOCKED');
      }
      return null;
    }

    // The duplicate-reservation exclusion (section 12.1); any other
    // exclusion overlap is a conflicting configuration write.
    case '23P01':
      if (e.constraint === 'reservation_no_duplicate_active') {
        return new AdulisException('DUPLICATE_RESERVATION');
      }
      return new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: e.constraint ? { constraint: e.constraint } : undefined,
      });

    // Overselling is a transaction failure, never a negative number
    // (section 10.1). Every OTHER check violation means our validation let
    // through what the schema had to stop — a defect, not a conflict.
    case '23514':
      if (e.constraint === 'product_variant_stock_count_check') {
        return new AdulisException('INSUFFICIENT_STOCK');
      }
      return null;

    case '23503':
      if (e.constraint && SCOPE_FK_CONSTRAINTS.has(e.constraint)) {
        return notFound();
      }
      return null;

    // A unique collision the handler did not translate itself (handlers own
    // the endpoint-specific readings, e.g. the scan nonce's replay
    // semantics): surfaced as a conflict naming the constraint.
    case '23505':
      return new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: e.constraint ? { constraint: e.constraint } : undefined,
      });

    default:
      return null;
  }
}

/** 42501 deserves its own loud path in the filter's logging. */
export function isPrivilegeDefect(e: PgError): boolean {
  return e.code === '42501';
}
